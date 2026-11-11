import { getLastRefreshTs, readAllSheets, type SheetTab } from "@/lib/sheets/read";

/**
 * Quando cada fonte foi atualizada. O app sabe duas coisas, e a ferramenta
 * devolve as duas sem inventar uma terceira:
 *
 *  - a hora do último refresh completo do cache (quando o dashboard releu
 *    as planilhas);
 *  - a data mais recente presente em cada aba (até onde o dado chega).
 *
 * A hora em que cada extração rodou no servidor não chega ao app.
 */

/** `campos`: datas que contam como "dado mais recente" da fonte (vale a maior). */
type Fonte = { nome: string; aba: SheetTab; campos: string[] };

export const FONTES: Fonte[] = [
  { nome: "Meta Ads (investimento e anúncios)", aba: "fb_todos", campos: ["day"] },
  { nome: "Leads (formulários)", aba: "leads", campos: ["dataInscricao"] },
  // Duas linhas, de propósito. Juntas (valia a maior data), a mudança de
  // etapa de um negócio antigo escondeu por dias que os negócios novos
  // chegavam sem data de criação e não eram contados.
  { nome: "Clint — negócios criados", aba: "clint", campos: ["dataCriacao"] },
  { nome: "Clint — mudança de etapa", aba: "clint", campos: ["dataEntradaEtapa"] },
  { nome: "SDR (planilha, até a migração para o Clint)", aba: "sdr", campos: ["dataAgendamento"] },
  { nome: "Vendas", aba: "vendas", campos: ["dataCompra"] },
  { nome: "Instagram Metta — perfil", aba: "ig_metta_perfil", campos: ["data"] },
  { nome: "Instagram Tiago — perfil", aba: "ig_tiago_perfil", campos: ["data"] },
  { nome: "Clint — atividades comerciais", aba: "atv_acoes", campos: ["dia"] },
];

function fmtDataHora(ts: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ts));
}

function fmtDia(ts: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ts));
}

/** Maior data válida do campo, sem passar de amanhã (data digitada errada não conta). */
function maiorData(rows: Record<string, unknown>[], campos: string[], teto: number): number | null {
  let max: number | null = null;
  for (const r of rows) {
    for (const campo of campos) {
      const v = r[campo];
      let ts: number | null = null;
      if (v instanceof Date) ts = v.getTime();
      else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        ts = new Date(`${v.slice(0, 10)}T12:00:00-03:00`).getTime();
      }
      if (ts === null || !Number.isFinite(ts) || ts > teto) continue;
      if (max === null || ts > max) max = ts;
    }
  }
  return max;
}

export async function statusAtualizacao(): Promise<string> {
  const [stamp, data] = await Promise.all([
    getLastRefreshTs(),
    readAllSheets(FONTES.map((f) => f.aba)),
  ]);
  const teto = Date.now() + 36 * 60 * 60 * 1000;
  const linhas = FONTES.map((f) => {
    const rows = (data as Record<string, Record<string, unknown>[]>)[f.aba] ?? [];
    const ts = maiorData(rows, f.campos, teto);
    return `| ${f.nome} | ${ts === null ? "sem dado" : fmtDia(ts)} | ${rows.length.toLocaleString("pt-BR")} |`;
  });
  return [
    "# Atualização dos dados",
    "",
    `Último refresh completo do cache do dashboard: ${stamp ? fmtDataHora(stamp) + " (horário de Brasília)" : "sem registro"}.`,
    "O cache é o que as páginas leem; ele é renovado de hora em hora pelo servidor de extrações.",
    "",
    "| Fonte | Dado mais recente | Linhas |",
    "| --- | --- | --- |",
    ...linhas,
    "",
    '"Dado mais recente" é a última data presente na fonte, não a hora em que a extração rodou.',
  ].join("\n");
}
