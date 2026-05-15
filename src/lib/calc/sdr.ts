/**
 * Cálculo da página Comercial SDR.
 *
 * Usa: leads (volume recebido) + sdr (atividades, agendamentos, reuniões).
 */

import {
  filterByDate,
  filterByFunil,
  normalizeQualif,
  parseData,
  safeRate,
} from "./shared";
import type {
  FilterState,
  RawData,
  Row,
  SDRHeatmapCell,
  SDRResult,
  SDRRow,
} from "./types";

function leadDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["created_at"] ?? r["Data de criação"]
  );
}

function leadFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["I"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function leadQualif(r: Row): string {
  const v =
    r["Qualificação"] ??
    r["Qualificacao"] ??
    r["qualificacao"] ??
    r["qualif"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

/** SDR responsável pelo lead. TODO: confirmar header. */
function leadSdr(r: Row): string {
  const v =
    r["SDR"] ?? r["sdr"] ?? r["Responsável"] ?? r["Responsavel"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function sdrDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data da reunião"] ?? r["created_at"]
  );
}

function sdrStatus(r: Row): string {
  const v = r["Status"] ?? r["status"] ?? r["K"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function sdrFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

/** Nome do SDR na aba sdr. TODO: confirmar header. */
function sdrNome(r: Row): string {
  const v = r["SDR"] ?? r["sdr"] ?? r["Responsável"] ?? r["Responsavel"] ?? "";
  return typeof v === "string" ? v : String(v);
}

/** Indica que o SDR fez tentativa de contato. TODO: confirmar coluna real. */
function sdrFezContato(r: Row): boolean {
  const status = sdrStatus(r).toLowerCase();
  // Considera contato qualquer registro que não seja "Sem contato" / vazio.
  if (!status) return false;
  if (status.includes("sem contato")) return false;
  return true;
}

export function calcSDR(
  raw: Pick<RawData, "leads" | "sdr">,
  filters: FilterState
): SDRResult {
  const { from, to, funis } = filters;

  const leadsFiltrado = filterByFunil(
    filterByDate(raw.leads, leadDate, from, to),
    leadFunil,
    funis
  );

  const sdrFiltrado = filterByFunil(
    filterByDate(raw.sdr, sdrDate, from, to),
    sdrFunil,
    funis
  );

  // --- KPIs ----------------------------------------------------------------
  const leadsRecebidos = leadsFiltrado.length;

  const tentativasContato = sdrFiltrado.filter(sdrFezContato).length;

  const agendamentos = sdrFiltrado.filter((r) => {
    const s = sdrStatus(r).toLowerCase();
    return s.includes("agend") || s.includes("realiz");
  }).length;

  const reunioes = sdrFiltrado.filter((r) =>
    sdrStatus(r).toLowerCase().includes("realiz")
  ).length;

  const taxaContato = safeRate(tentativasContato, leadsRecebidos);
  const taxaAgendamento = safeRate(agendamentos, tentativasContato);
  const taxaShow = safeRate(reunioes, agendamentos);

  // --- Heatmap dia-semana × hora ------------------------------------------
  const heatmapMap = new Map<string, number>();
  for (const r of sdrFiltrado) {
    const d = sdrDate(r);
    if (!d) continue;
    const ds = d.getDay();
    const h = d.getHours();
    const k = `${ds}|${h}`;
    heatmapMap.set(k, (heatmapMap.get(k) ?? 0) + 1);
  }
  const heatmap: SDRHeatmapCell[] = [];
  for (let ds = 0; ds < 7; ds++) {
    for (let h = 0; h < 24; h++) {
      heatmap.push({
        diaSemana: ds,
        hora: h,
        total: heatmapMap.get(`${ds}|${h}`) ?? 0,
      });
    }
  }

  // --- Tabela por SDR -----------------------------------------------------
  const leadsPorSdr = new Map<string, number>();
  for (const r of leadsFiltrado) {
    // Considera apenas leads qualificados (MQL+) ao "atribuir" pro SDR.
    // Mantemos leads totais aqui — o KPI por SDR mais útil é volume recebido.
    const q = normalizeQualif(leadQualif(r));
    if (q === "Outros") continue;
    const name = leadSdr(r) || "—";
    leadsPorSdr.set(name, (leadsPorSdr.get(name) ?? 0) + 1);
  }

  const tentPorSdr = new Map<string, number>();
  const agendPorSdr = new Map<string, number>();
  const reuPorSdr = new Map<string, number>();

  for (const r of sdrFiltrado) {
    const name = sdrNome(r) || "—";
    if (sdrFezContato(r))
      tentPorSdr.set(name, (tentPorSdr.get(name) ?? 0) + 1);
    const s = sdrStatus(r).toLowerCase();
    if (s.includes("agend") || s.includes("realiz"))
      agendPorSdr.set(name, (agendPorSdr.get(name) ?? 0) + 1);
    if (s.includes("realiz"))
      reuPorSdr.set(name, (reuPorSdr.get(name) ?? 0) + 1);
  }

  const sdrNomes = new Set<string>([
    ...leadsPorSdr.keys(),
    ...tentPorSdr.keys(),
    ...agendPorSdr.keys(),
    ...reuPorSdr.keys(),
  ]);

  const porSdr: SDRRow[] = Array.from(sdrNomes)
    .map((name) => {
      const leads = leadsPorSdr.get(name) ?? 0;
      const tent = tentPorSdr.get(name) ?? 0;
      const agend = agendPorSdr.get(name) ?? 0;
      const reu = reuPorSdr.get(name) ?? 0;
      return {
        sdr: name,
        leadsAtribuidos: leads,
        tentativas: tent,
        agendamentos: agend,
        reunioes: reu,
        taxaContato: safeRate(tent, leads),
        taxaAgendamento: safeRate(agend, tent),
        taxaShow: safeRate(reu, agend),
      };
    })
    .sort((a, b) => b.reunioes - a.reunioes);

  return {
    kpis: {
      leadsRecebidos,
      tentativasContato,
      agendamentos,
      reunioes,
      taxaContato,
      taxaAgendamento,
      taxaShow,
    },
    heatmap,
    porSdr,
  };
}
