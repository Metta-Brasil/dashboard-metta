/**
 * Cálculo da página Visão Geral.
 *
 * Lógica conhecida da Análise Geral da planilha:
 *   - fb_todos.C contém "PERP+CAPT+<funil>" — usado para filtrar campanhas
 *   - leads.I contém o nome do funil
 *   - sdr.K = "Realizada" indica reunião realizada
 *   - vendas.K filtra por funil
 *   - Qualificação de leads: Enterprise / MQL1 / MQL2
 *
 * Para campos não confirmados, o acesso é defensivo e segue marcado com TODO.
 */

import {
  dayKey,
  eachDay,
  extractFunilFromConversao,
  filterByDate,
  filterByFunil,
  normalizeQualif,
  parseData,
  parseValor,
  safeRate,
  startOfDay,
  sumBy,
} from "./shared";
import type {
  DailyPoint,
  FilterState,
  FunnelStep,
  RawData,
  Row,
  VisaoGeralResult,
} from "./types";

// ---------------------------------------------------------------------------
// Acessores defensivos por aba — colunas conhecidas ficam aqui.
// ---------------------------------------------------------------------------

/** fb_todos: data do registro. TODO: confirmar nome da coluna real ("Day"?). */
function fbDate(r: Row): Date | null {
  return parseData(r["Day"] ?? r["day"] ?? r["data"] ?? r["Data"]);
}

/** fb_todos.C: string "PERP+CAPT+<funil>". TODO: confirmar header da coluna C. */
function fbConversao(r: Row): string | undefined {
  const v =
    r["Conversao"] ??
    r["Conversão"] ??
    r["conversao"] ??
    r["conversion_objective"] ??
    r["C"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function fbInvestimento(r: Row): number {
  return parseValor(
    (r["Amount spent (BRL)"] ??
      r["Investimento"] ??
      r["Valor usado"] ??
      r["spend"] ??
      r["amount_spent"]) as string | number | undefined
  );
}

function fbImpressoes(r: Row): number {
  return parseValor(
    (r["Impressions"] ?? r["Impressoes"] ?? r["Impressões"] ?? r["impressions"]) as
      | string
      | number
      | undefined
  );
}

function fbCliques(r: Row): number {
  return parseValor(
    (r["Link clicks"] ??
      r["Cliques"] ??
      r["Clicks"] ??
      r["clicks"] ??
      r["link_clicks"]) as string | number | undefined
  );
}

/** leads: data de criação. TODO: confirmar coluna real. */
function leadDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["created_at"] ?? r["Data de criação"]
  );
}

/** leads.I: nome do funil. TODO: confirmar header da coluna I. */
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

/** sdr: data da atividade. TODO: confirmar coluna real. */
function sdrDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data da reunião"] ?? r["created_at"]
  );
}

/** sdr.K: status da reunião ("Realizada", "Agendada", etc). TODO: confirmar header. */
function sdrStatus(r: Row): string {
  const v = r["Status"] ?? r["status"] ?? r["K"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function sdrFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

/** vendas: data do fechamento. TODO: confirmar coluna real. */
function vendaDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data fechamento"] ?? r["closed_at"]
  );
}

/** vendas.K: funil. TODO: confirmar header da coluna K. */
function vendaFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["K"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function vendaValor(r: Row): number {
  return parseValor(
    (r["Valor"] ?? r["valor"] ?? r["Faturamento"] ?? r["amount"]) as
      | string
      | number
      | undefined
  );
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function calcVisaoGeral(
  raw: Pick<RawData, "fbTodos" | "leads" | "sdr" | "vendas">,
  filters: FilterState
): VisaoGeralResult {
  const { from, to, funis } = filters;

  // --- Filtros base por aba -------------------------------------------------

  const fbFiltrado = filterByFunil(
    filterByDate(raw.fbTodos, fbDate, from, to),
    (r) => {
      // Extrai o <funil> de "PERP+CAPT+<funil>" e usa para casar com filtros.
      const f = extractFunilFromConversao(fbConversao(r));
      return f ?? fbConversao(r);
    },
    funis
  );

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

  const vendasFiltrado = filterByFunil(
    filterByDate(raw.vendas, vendaDate, from, to),
    vendaFunil,
    funis
  );

  // --- KPIs ----------------------------------------------------------------

  const investimento = sumBy(fbFiltrado, fbInvestimento);
  const impressoes = sumBy(fbFiltrado, fbImpressoes);
  const cliques = sumBy(fbFiltrado, fbCliques);

  // MQL = leads cuja qualificação é Enterprise, MQL1 ou MQL2.
  const mqlRows = leadsFiltrado.filter((r) => {
    const q = normalizeQualif(leadQualif(r));
    return q === "Enterprise" || q === "MQL1" || q === "MQL2";
  });
  const mql = mqlRows.length;

  const agendamentos = sdrFiltrado.filter((r) => {
    const s = sdrStatus(r).toLowerCase();
    return s.includes("agend") || s.includes("realiz");
  }).length;

  const reunioes = sdrFiltrado.filter((r) =>
    sdrStatus(r).toLowerCase().includes("realiz")
  ).length;

  const vendasCount = vendasFiltrado.length;
  const faturamento = sumBy(vendasFiltrado, vendaValor);

  const cmql = safeRate(investimento, mql);
  const cac = safeRate(investimento, vendasCount);
  const roas = safeRate(faturamento, investimento);
  const conversaoVendas = safeRate(vendasCount, mql);

  // --- Série diária --------------------------------------------------------

  const dias = eachDay(from, to);
  // Pré-agrega cada métrica por dayKey para evitar varreduras O(n*d).
  const byDay = (rows: Row[], getDate: (r: Row) => Date | null) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const d = getDate(r);
      if (!d) continue;
      const k = dayKey(d);
      const bucket = m.get(k);
      if (bucket) bucket.push(r);
      else m.set(k, [r]);
    }
    return m;
  };

  const fbByDay = byDay(fbFiltrado, fbDate);
  const mqlByDay = byDay(mqlRows, leadDate);
  const sdrByDay = byDay(sdrFiltrado, sdrDate);
  const vendasByDay = byDay(vendasFiltrado, vendaDate);

  const serieDiaria: DailyPoint[] = dias.map((d) => {
    const k = dayKey(d);
    const fbRows = fbByDay.get(k) ?? [];
    const mqlD = mqlByDay.get(k) ?? [];
    const sdrD = sdrByDay.get(k) ?? [];
    const venD = vendasByDay.get(k) ?? [];
    return {
      dia: startOfDay(d),
      investimento: sumBy(fbRows, fbInvestimento),
      mql: mqlD.length,
      reunioes: sdrD.filter((r) =>
        sdrStatus(r).toLowerCase().includes("realiz")
      ).length,
      vendas: venD.length,
      faturamento: sumBy(venD, vendaValor),
    };
  });

  // --- Funil consolidado ---------------------------------------------------

  const etapas: Array<[string, number]> = [
    ["Investimento", investimento],
    ["Impressões", impressoes],
    ["Cliques", cliques],
    ["MQL", mql],
    ["Agendamento", agendamentos],
    ["Reunião", reunioes],
    ["Venda", vendasCount],
  ];

  const funilConsolidado: FunnelStep[] = etapas.map(([etapa, valor], i) => {
    if (i === 0) return { etapa, valor, conversaoEtapa: 1 };
    const prev = etapas[i - 1][1];
    return { etapa, valor, conversaoEtapa: safeRate(valor, prev) };
  });

  return {
    kpis: {
      investimento,
      mql,
      cmql,
      agendamentos,
      reunioes,
      vendas: vendasCount,
      faturamento,
      cac,
      roas,
      conversaoVendas,
    },
    serieDiaria,
    funilConsolidado,
  };
}
