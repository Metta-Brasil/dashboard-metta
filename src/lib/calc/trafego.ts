import {
  dedupeLeadsByEmail,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  groupBy,
  isMql,
  safeRate,
  startOfDayBrt,
  sumBy,
  eachDay,
} from "./shared";
import type {
  FilterState,
  RawData,
  TrafegoComboPoint,
  TrafegoKPIs,
  TrafegoRankingRow,
  TrafegoResult,
  FunnelStep,
} from "./types";

/**
 * Tráfego Pago — KPIs, série combo, ranking de campanhas, funil de tráfego.
 * Fonte: PRD §5.2.2 (linhas 1587-1900).
 */
export function calcTrafego(
  data: Pick<RawData, "fb_todos" | "leads">,
  filters: FilterState
): TrafegoResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base (funil + período)
  const fbTodosF = filterFbTodosByFunil(data.fb_todos, funis);
  const fbInRange = filterByDate(fbTodosF, (r) => r.day, filters.from, filters.to);

  const leadsF = filterLeadsByFunil(data.leads, funis);
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);

  // 2. KPIs agregados (PRD §5.2.2 — KPIs 5 colunas)
  const investimento = sumBy(fbInRange, (r) => r.amountSpent);
  const impressoes = sumBy(fbInRange, (r) => r.impressions);
  const cliques = sumBy(fbInRange, (r) => r.linkClicks);

  const mql = leadsUnicos.filter((l) => isMql(l.qualificacao)).length;

  const ctr = safeRate(cliques, impressoes);
  const cpc = safeRate(investimento, cliques);
  const cpm = impressoes > 0 ? (investimento * 1000) / impressoes : 0;
  const cmql = safeRate(investimento, mql);

  const kpis: TrafegoKPIs = {
    investimento,
    impressoes,
    cliques,
    ctr,
    cpc,
    cpm,
    mql,
    cmql,
  };

  // 3. Série combo diária (Investimento, Cliques, MQL) — PRD §5.2.2 "Combo investimento/MQL/CMQL"
  const days = eachDay(filters.from, filters.to);
  const serieCombo: TrafegoComboPoint[] = days.map((dia) => {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) =>
      d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;

    const fbDay = fbInRange.filter((r) => inDay(r.day));
    const leadsDay = leadsInRange.filter((r) => inDay(r.dataInscricao));
    const leadsDayUnicos = dedupeLeadsByEmail(leadsDay);

    return {
      dia,
      investimento: sumBy(fbDay, (r) => r.amountSpent),
      cliques: sumBy(fbDay, (r) => r.linkClicks),
      mql: leadsDayUnicos.filter((l) => isMql(l.qualificacao)).length,
    };
  });

  // 4. Ranking por campanha — PRD §5.2.2 "Ranking de mídia"
  // Agrupa fb_todos por campaignName; cruza leads via utm_campaign (substring match bidireccional).
  const fbByCampanha = groupBy(fbInRange, (r) => r.campaignName);

  const ranking: TrafegoRankingRow[] = [];
  for (const [campanha, rows] of fbByCampanha.entries()) {
    if (!campanha) continue;
    const inv = sumBy(rows, (r) => r.amountSpent);
    const imp = sumBy(rows, (r) => r.impressions);
    const clk = sumBy(rows, (r) => r.linkClicks);

    // Match de leads por UTM (substring nos dois sentidos — UTM pode ser truncado ou conter sufixo).
    const leadsCamp = leadsUnicos.filter((l) => {
      const utm = l.utmCampaign;
      if (!utm) return false;
      return campanha.includes(utm) || utm.includes(campanha);
    });
    const mqlCamp = leadsCamp.filter((l) => isMql(l.qualificacao)).length;

    ranking.push({
      campanha,
      investimento: inv,
      impressoes: imp,
      cliques: clk,
      ctr: safeRate(clk, imp),
      cpc: safeRate(inv, clk),
      mql: mqlCamp,
      cmql: safeRate(inv, mqlCamp),
    });
  }
  // Ordenação default: investimento desc (proxy de relevância — PRD sugere CMQL asc,
  // mas com muitas linhas zeradas isso enche o topo de "—"; mantemos invest desc).
  ranking.sort((a, b) => b.investimento - a.investimento);

  // 5. Funil de tráfego (5 etapas) — PRD §5.2.2 "Funil de tráfego"
  const lpViews = sumBy(fbInRange, (r) => r.landingPageViews);
  const leadsCount = leadsUnicos.length;

  const funilTrafego: FunnelStep[] = [
    {
      etapa: "Impressões",
      valor: impressoes,
      conversaoEtapa: 1,
    },
    {
      etapa: "Cliques",
      valor: cliques,
      conversaoEtapa: safeRate(cliques, impressoes),
    },
    {
      etapa: "Visualizações de página",
      valor: lpViews,
      conversaoEtapa: safeRate(lpViews, cliques),
    },
    {
      etapa: "Leads",
      valor: leadsCount,
      conversaoEtapa: safeRate(leadsCount, lpViews),
    },
    {
      etapa: "MQL",
      valor: mql,
      conversaoEtapa: safeRate(mql, leadsCount),
    },
  ];

  return {
    kpis,
    serieCombo,
    ranking,
    funilTrafego,
  };
}
