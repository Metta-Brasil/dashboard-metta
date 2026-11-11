import type { ClintRow, LeadRow } from "@/lib/sheets/schemas";
import type { FilterState, RawData } from "@/lib/calc/types";

import { clintRows } from "./clint";
import { FUNIS_FIXOS, SEM_FUNIL, funilKey } from "./shared";

/**
 * Recorte das páginas de funil dinâmico (Visão Geral, Metas, SDR, Closer,
 * Origem, Resgate): origem do lead (pago × orgânico) e pipeline da Clint.
 *
 * Os dois cortes entram AQUI, nas abas brutas e antes de `mergeClint`, para
 * que nenhum cálculo de página precise saber deles: quem chega no calc já
 * é só o que pertence ao recorte. O corte de funil continua nos helpers
 * `filter*ByFunil` de shared.ts, que cada calc já chama.
 */

// ----- Origem (pago × orgânico) ----------------------------------------------

export type Origem = "pago" | "organico";

/**
 * Regra combinada com o Alisson (11/11/2026): pago é o `utm_source` que
 * começa com `fbads` ou `gads` (fbads_quente, fbads_frio, fbads_advantage,
 * gads_institucional…); todo o resto é orgânico — `organico`, `bio-*`,
 * `ig`, `whatsapp` e também a entrada sem UTM (outras origens ou cadastro
 * feito à mão pelo comercial).
 */
export function origemDe(utmSource: string | null | undefined): Origem {
  return /^(fbads|gads)/i.test(String(utmSource ?? "").trim()) ? "pago" : "organico";
}

// ----- Opções dos filtros ------------------------------------------------------

export type EscopoOpcao = { value: string; label: string; count: number };

const LABEL_FIXO: Record<(typeof FUNIS_FIXOS)[number], string> = {
  sala: "Sala",
  aplica: "Aplicação",
  sessao: "Sessão",
  isca: "Isca",
  reality: "Reality",
};

type FunilSources = {
  leads?: LeadRow[];
  clint?: ClintRow[];
};

/**
 * Funis que existem no dado. Os 5 de sempre vêm primeiro e sempre aparecem;
 * depois, cada nome novo que surgir no campo `funil` (com a grafia mais
 * frequente como rótulo); por último "Sem funil", se houver linha assim.
 * Ninguém precisa cadastrar funil novo: ele aparece quando o primeiro
 * lead ou negócio chega com esse nome.
 *
 * Só as fontes vivas contam (formulários e Clint). As abas legadas `sdr` e
 * `vendas` (até a migração para a Clint) trazem dezenas de rótulos antigos
 * digitados à mão ("Upsell", "Indicação", "Não"…): essas linhas continuam
 * dentro de "Todos", mas não viram opção de filtro.
 */
export function listFunis(data: FunilSources): EscopoOpcao[] {
  const counts = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  const add = (raw: string) => {
    const key = funilKey(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const s = String(raw ?? "").trim();
    if (!s) return;
    const by = spellings.get(key) ?? new Map<string, number>();
    by.set(s, (by.get(s) ?? 0) + 1);
    spellings.set(key, by);
  };
  for (const r of data.leads ?? []) add(r.funil);
  for (const r of clintRows(data)) add(r.funil);

  const fixos = new Set<string>(FUNIS_FIXOS);
  const out: EscopoOpcao[] = FUNIS_FIXOS.map((f) => ({
    value: f,
    label: LABEL_FIXO[f],
    count: counts.get(f) ?? 0,
  }));
  const novos = [...counts.keys()]
    .filter((k) => !fixos.has(k) && k !== SEM_FUNIL)
    .map((k) => {
      const by = [...(spellings.get(k) ?? new Map<string, number>())].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")
      );
      return { value: k, label: by[0]?.[0] ?? k, count: counts.get(k) ?? 0 };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  out.push(...novos);
  const semFunil = counts.get(SEM_FUNIL) ?? 0;
  if (semFunil > 0) out.push({ value: SEM_FUNIL, label: "Sem funil", count: semFunil });
  return out;
}

/**
 * Pipelines da Clint (quadro do CRM), pelo `pipelineId`. O nome é o atual
 * de cada id; renomear a pipeline na Clint não quebra o filtro.
 */
export function listPipelines(data: { clint?: ClintRow[] }): EscopoOpcao[] {
  const by = new Map<string, EscopoOpcao>();
  for (const r of clintRows(data)) {
    if (!r.pipelineId) continue;
    const cur = by.get(r.pipelineId);
    if (cur) {
      cur.count += 1;
      if (r.pipeline) cur.label = r.pipeline;
    } else {
      by.set(r.pipelineId, { value: r.pipelineId, label: r.pipeline || r.pipelineId, count: 1 });
    }
  }
  return [...by.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")
  );
}

// ----- Aplicação do recorte ----------------------------------------------------

/**
 * Aplica origem e pipeline às abas brutas. Chamar ANTES de `mergeClint`.
 *
 * Origem "organico": investimento não existe (fb_todos vazio).
 * Pipeline: a página passa a ler só a Clint — negócios daquela pipeline.
 * Investimento, leads/MQL e as abas legadas (sdr/vendas de antes da
 * migração) ficam vazios: nada disso é atribuível a uma pipeline.
 */
export function aplicarEscopo<T extends Partial<RawData>>(
  data: T,
  filters: Pick<FilterState, "origem" | "clintPipelines">
): T {
  const origem = filters.origem && filters.origem !== "todos" ? filters.origem : null;
  const pipeline = filters.clintPipelines?.length ? new Set(filters.clintPipelines) : null;
  if (!origem && !pipeline) return data;

  const patch: Partial<RawData> = {};
  const daOrigem = (utm: string) => !origem || origemDe(utm) === origem;

  if (data.clint) {
    patch.clint = data.clint.filter(
      (r) => daOrigem(r.utmSource) && (!pipeline || pipeline.has(r.pipelineId))
    );
  }
  if (data.leads) {
    patch.leads = pipeline ? [] : data.leads.filter((r) => daOrigem(r.utmSource));
  }
  if (data.sdr) {
    patch.sdr = pipeline ? [] : data.sdr.filter((r) => daOrigem(r.utmSourceSnap));
  }
  if (data.vendas) {
    patch.vendas = pipeline ? [] : data.vendas.filter((r) => daOrigem(r.utmSourceSnap));
  }
  if (data.fb_todos && (pipeline || origem === "organico")) {
    patch.fb_todos = [];
  }
  return { ...data, ...patch };
}
