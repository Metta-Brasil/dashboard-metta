/**
 * Cálculo da página Tráfego Pago.
 *
 * Usa: fb_todos (investimento, impressões, cliques) + leads (MQL).
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
  FilterState,
  FunnelStep,
  RawData,
  Row,
  TrafegoComboPoint,
  TrafegoRankingRow,
  TrafegoResult,
} from "./types";

function fbDate(r: Row): Date | null {
  return parseData(r["Day"] ?? r["day"] ?? r["data"] ?? r["Data"]);
}

function fbConversao(r: Row): string | undefined {
  const v =
    r["Conversao"] ??
    r["Conversão"] ??
    r["conversao"] ??
    r["C"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

/** Nome da campanha. TODO: confirmar header. */
function fbCampanha(r: Row): string {
  const v =
    r["Campaign name"] ??
    r["Campanha"] ??
    r["campaign_name"] ??
    r["campanha"] ??
    "";
  return typeof v === "string" ? v : String(v);
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

/** Nome da campanha no lead (utm_campaign). TODO: confirmar header. */
function leadCampanha(r: Row): string {
  const v =
    r["utm_campaign"] ??
    r["UTM Campaign"] ??
    r["Campanha"] ??
    r["campanha"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

export function calcTrafego(
  raw: Pick<RawData, "fbTodos" | "leads">,
  filters: FilterState
): TrafegoResult {
  const { from, to, funis } = filters;

  const fbFiltrado = filterByFunil(
    filterByDate(raw.fbTodos, fbDate, from, to),
    (r) => extractFunilFromConversao(fbConversao(r)) ?? fbConversao(r),
    funis
  );

  const leadsFiltrado = filterByFunil(
    filterByDate(raw.leads, leadDate, from, to),
    leadFunil,
    funis
  );

  const mqlRows = leadsFiltrado.filter((r) => {
    const q = normalizeQualif(leadQualif(r));
    return q === "Enterprise" || q === "MQL1" || q === "MQL2";
  });

  // --- KPIs ----------------------------------------------------------------
  const investimento = sumBy(fbFiltrado, fbInvestimento);
  const impressoes = sumBy(fbFiltrado, fbImpressoes);
  const cliques = sumBy(fbFiltrado, fbCliques);
  const mql = mqlRows.length;

  const ctr = safeRate(cliques, impressoes);
  const cpc = safeRate(investimento, cliques);
  const cpm = safeRate(investimento * 1000, impressoes);
  const cmql = safeRate(investimento, mql);

  // --- Série combo --------------------------------------------------------
  const dias = eachDay(from, to);
  const fbByDay = new Map<string, Row[]>();
  for (const r of fbFiltrado) {
    const d = fbDate(r);
    if (!d) continue;
    const k = dayKey(d);
    const b = fbByDay.get(k);
    if (b) b.push(r);
    else fbByDay.set(k, [r]);
  }
  const mqlByDay = new Map<string, number>();
  for (const r of mqlRows) {
    const d = leadDate(r);
    if (!d) continue;
    const k = dayKey(d);
    mqlByDay.set(k, (mqlByDay.get(k) ?? 0) + 1);
  }

  const serieCombo: TrafegoComboPoint[] = dias.map((d) => {
    const k = dayKey(d);
    const fbRows = fbByDay.get(k) ?? [];
    return {
      dia: startOfDay(d),
      investimento: sumBy(fbRows, fbInvestimento),
      cliques: sumBy(fbRows, fbCliques),
      mql: mqlByDay.get(k) ?? 0,
    };
  });

  // --- Ranking por campanha -----------------------------------------------
  const porCampanha = new Map<string, Row[]>();
  for (const r of fbFiltrado) {
    const c = fbCampanha(r) || "—";
    const b = porCampanha.get(c);
    if (b) b.push(r);
    else porCampanha.set(c, [r]);
  }

  const mqlPorCampanha = new Map<string, number>();
  for (const r of mqlRows) {
    const c = leadCampanha(r) || "—";
    mqlPorCampanha.set(c, (mqlPorCampanha.get(c) ?? 0) + 1);
  }

  const ranking: TrafegoRankingRow[] = Array.from(porCampanha.entries())
    .map(([campanha, rows]) => {
      const inv = sumBy(rows, fbInvestimento);
      const imp = sumBy(rows, fbImpressoes);
      const cl = sumBy(rows, fbCliques);
      const m = mqlPorCampanha.get(campanha) ?? 0;
      return {
        campanha,
        investimento: inv,
        impressoes: imp,
        cliques: cl,
        ctr: safeRate(cl, imp),
        cpc: safeRate(inv, cl),
        mql: m,
        cmql: safeRate(inv, m),
      };
    })
    .sort((a, b) => b.investimento - a.investimento);

  // --- Funil tráfego ------------------------------------------------------
  const etapas: Array<[string, number]> = [
    ["Investimento", investimento],
    ["Impressões", impressoes],
    ["Cliques", cliques],
    ["MQL", mql],
  ];
  const funilTrafego: FunnelStep[] = etapas.map(([etapa, valor], i) => ({
    etapa,
    valor,
    conversaoEtapa: i === 0 ? 1 : safeRate(valor, etapas[i - 1][1]),
  }));

  return {
    kpis: {
      investimento,
      impressoes,
      cliques,
      ctr,
      cpc,
      cpm,
      mql,
      cmql,
    },
    serieCombo,
    ranking,
    funilTrafego,
  };
}
