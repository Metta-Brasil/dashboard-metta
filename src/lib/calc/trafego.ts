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
  type RowSource,
} from "./shared";
import { clintRows } from "./clint";
import type {
  FilterState,
  Funil,
  RawData,
  TrafegoComboPoint,
  TrafegoConversaoTaxa,
  TrafegoConversaoDiaPoint,
  TrafegoCustoEtapa,
  TrafegoCustoDiaPoint,
  TrafegoFunilResumo,
  TrafegoKPIs,
  TrafegoMqlCmqlPorFunil,
  TrafegoMqlPorTemperatura,
  TrafegoRankingRow,
  TrafegoResult,
  FunnelStep,
} from "./types";

/**
 * Tráfego Pago — KPIs, série combo, ranking de campanhas/adsets, funil de tráfego.
 * Fonte: PRD §5.2.2 (linhas 1587-1900) + docs/inventario-completude.md linhas 140-263.
 */
export function calcTrafego(
  data: Pick<RawData, "fb_todos" | "leads" | "clint">,
  filters: FilterState
): TrafegoResult {
  const funis = filters.funis ?? ["todos"];
  const rankingBy: "campanha" | "adset" = filters.rankingBy ?? "campanha";

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
  const lpViews = sumBy(fbInRange, (r) => r.landingPageViews);

  const leadsCount = leadsUnicos.length;
  const mql = leadsUnicos.filter((l) => isMql(l.qualificacao)).length;

  // Negócios criados (Clint, jul+): contagem por data de criação.
  const clintF = filterLeadsByFunil(clintRows(data), funis).map((c) => ({
    ...c,
    _src: "clint" as RowSource,
  }));
  const negociosInRange = filterByDate(
    clintF,
    (r) => r.dataCriacao,
    filters.from,
    filters.to
  );
  const negociosCriados = negociosInRange.length;
  const custoPorNegocio = safeRate(investimento, negociosCriados);

  const ctr = safeRate(cliques, impressoes);
  const cpc = safeRate(investimento, cliques);
  const cpm = impressoes > 0 ? (investimento * 1000) / impressoes : 0;
  const cpl = safeRate(investimento, leadsCount);
  const cmql = safeRate(investimento, mql);
  const txLpLead = safeRate(leadsCount, lpViews);
  const txLeadMql = safeRate(mql, leadsCount);

  const kpis: TrafegoKPIs = {
    investimento,
    impressoes,
    cliques,
    ctr,
    cpc,
    cpm,
    leads: leadsCount,
    cpl,
    txLpLead,
    mql,
    cmql,
    txLeadMql,
    negociosCriados,
    custoPorNegocio,
  };

  // 3. Série combo diária (Investimento, Cliques, Leads, MQL, CMQL) — PRD §5.2.2 "Combo investimento/MQL/CMQL"
  const days = eachDay(filters.from, filters.to);
  const serieCombo: TrafegoComboPoint[] = days.map((dia) => {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) =>
      d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;

    const fbDay = fbInRange.filter((r) => inDay(r.day));
    const leadsDay = leadsInRange.filter((r) => inDay(r.dataInscricao));
    const leadsDayUnicos = dedupeLeadsByEmail(leadsDay);

    const invDay = sumBy(fbDay, (r) => r.amountSpent);
    const leadsDayCount = leadsDayUnicos.length;
    const mqlDay = leadsDayUnicos.filter((l) => isMql(l.qualificacao)).length;
    const negociosDay = negociosInRange.filter((c) =>
      inDay(c.dataCriacao)
    ).length;

    return {
      dia,
      investimento: invDay,
      cliques: sumBy(fbDay, (r) => r.linkClicks),
      leads: leadsDayCount,
      mql: mqlDay,
      cmql: mqlDay > 0 ? invDay / mqlDay : null,
      negociosCriados: negociosDay,
      custoPorNegocio: negociosDay > 0 ? invDay / negociosDay : null,
    };
  });

  // 3b. Séries diárias de Conversões (taxas %) e Custos (R$) — mesmas
  // fórmulas dos agregados (itens 8/9), porém por dia.
  const serieConversoesDia: TrafegoConversaoDiaPoint[] = [];
  const serieCustosDia: TrafegoCustoDiaPoint[] = [];
  for (const dia of days) {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) =>
      d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;

    const fbDay = fbInRange.filter((r) => inDay(r.day));
    const leadsDayUnicos = dedupeLeadsByEmail(
      leadsInRange.filter((r) => inDay(r.dataInscricao))
    );

    const invDay = sumBy(fbDay, (r) => r.amountSpent);
    const impDay = sumBy(fbDay, (r) => r.impressions);
    const clkDay = sumBy(fbDay, (r) => r.linkClicks);
    const lpvDay = sumBy(fbDay, (r) => r.landingPageViews);
    const leadsDayCount = leadsDayUnicos.length;
    const mqlDay = leadsDayUnicos.filter((l) => isMql(l.qualificacao)).length;

    serieConversoesDia.push({
      dia,
      ctr: safeRate(clkDay, impDay),
      conexaoLp: safeRate(lpvDay, clkDay),
      conversaoLp: safeRate(leadsDayCount, lpvDay),
      conversaoCliques: safeRate(leadsDayCount, clkDay),
    });
    serieCustosDia.push({
      dia,
      cpc: safeRate(invDay, clkDay),
      cpm: impDay > 0 ? (invDay * 1000) / impDay : 0,
      cpl: safeRate(invDay, leadsDayCount),
      cmql: mqlDay > 0 ? invDay / mqlDay : null,
    });
  }

  // 4. MQL & CMQL por funil — 5 funis fixos.
  // Refiltra fb_todos + leads pelo funil específico, ignorando `funis` selecionado
  // (PRD §5.2.2.E linhas 1772-1778: gráfico mostra TODOS os 5 funis sempre).
  const FUNIS_FIXOS: Funil[] = ["sala", "aplica", "sessao", "isca", "reality"];
  const mqlCmqlPorFunil: TrafegoMqlCmqlPorFunil[] = FUNIS_FIXOS.map((funil) => {
    const fbFunil = filterByDate(
      filterFbTodosByFunil(data.fb_todos, [funil]),
      (r) => r.day,
      filters.from,
      filters.to
    );
    const leadsFunil = dedupeLeadsByEmail(
      filterByDate(
        filterLeadsByFunil(data.leads, [funil]),
        (r) => r.dataInscricao,
        filters.from,
        filters.to
      )
    );
    const invFunil = sumBy(fbFunil, (r) => r.amountSpent);
    const mqlFunil = leadsFunil.filter((l) => isMql(l.qualificacao)).length;
    return {
      funil,
      mql: mqlFunil,
      cmql: mqlFunil > 0 ? invFunil / mqlFunil : null,
      investimento: invFunil,
    };
  });

  // 4b. MQL por temperatura — deriva da utm_source do lead (snapshot ausente neste
  // escopo: trafego.ts opera só sobre leads filtrados por funil/período, sem join
  // SDR/Venda). Mapa: contém "advantage" → Advantage; "quente" → Quente; "frio" →
  // Frio; resto não entra. MQL = mesma definição (isMql) já usada acima, sobre os
  // leads únicos do recorte atual (período/funil aplicados).
  const tempMql: Record<"Advantage" | "Quente" | "Frio", number> = {
    Advantage: 0,
    Quente: 0,
    Frio: 0,
  };
  for (const lead of leadsUnicos) {
    if (!isMql(lead.qualificacao)) continue;
    const src = (lead.utmSource ?? "").toLowerCase();
    if (src.includes("advantage")) tempMql.Advantage += 1;
    else if (src.includes("quente")) tempMql.Quente += 1;
    else if (src.includes("frio")) tempMql.Frio += 1;
  }
  const mqlPorTemperatura: TrafegoMqlPorTemperatura[] = [
    { temperatura: "Advantage", mql: tempMql.Advantage },
    { temperatura: "Quente", mql: tempMql.Quente },
    { temperatura: "Frio", mql: tempMql.Frio },
  ];

  // 5. Ranking de mídia — agrupa por campaignName OU adSetName (toggle filters.rankingBy).
  // Match de leads por utm_campaign (substring nos dois sentidos — UTM pode ser truncado ou conter sufixo).
  const keyFn = rankingBy === "adset"
    ? (r: typeof fbInRange[number]) => r.adSetName
    : (r: typeof fbInRange[number]) => r.campaignName;

  const fbByKey = groupBy(fbInRange, keyFn);

  const ranking: TrafegoRankingRow[] = [];
  for (const [nome, rows] of fbByKey.entries()) {
    if (!nome) continue;
    const inv = sumBy(rows, (r) => r.amountSpent);
    const imp = sumBy(rows, (r) => r.impressions);
    const clk = sumBy(rows, (r) => r.linkClicks);
    const lpv = sumBy(rows, (r) => r.landingPageViews);

    // Match de leads por UTM (substring nos dois sentidos).
    // No modo 'adset', mantém a mesma lógica de utm_campaign — UTM normalmente
    // referencia o nome de campanha, e não há utm_adset; aceitamos a aproximação
    // (lead atribuído à campanha que contém o adset; pode dar overcount inter-adsets
    // dentro da mesma campanha, mas é o melhor join disponível).
    const leadsRow = leadsUnicos.filter((l) => {
      const utm = l.utmCampaign;
      if (!utm) return false;
      return nome.includes(utm) || utm.includes(nome);
    });
    const leadsRowCount = leadsRow.length;
    const mqlRow = leadsRow.filter((l) => isMql(l.qualificacao)).length;

    // Negócios criados atribuídos por utm_campaign (mesmo match dos leads).
    const negociosRow = negociosInRange.filter((c) => {
      const utm = c.utmCampaign;
      if (!utm) return false;
      return nome.includes(utm) || utm.includes(nome);
    }).length;

    ranking.push({
      nome,
      agrupamento: rankingBy,
      investimento: inv,
      impressoes: imp,
      cliques: clk,
      ctr: safeRate(clk, imp),
      cpc: safeRate(inv, clk),
      cpm: imp > 0 ? (inv * 1000) / imp : 0,
      lpViews: lpv,
      leads: leadsRowCount,
      cpl: safeRate(inv, leadsRowCount),
      mql: mqlRow,
      cmql: mqlRow > 0 ? inv / mqlRow : Infinity,
      negociosCriados: negociosRow,
      custoPorNegocio: safeRate(inv, negociosRow),
    });
  }

  // Ordenação default: CMQL ASC (PRD §5.2.2.E linha 1807).
  // Linhas sem MQL (cmql = Infinity) vão pro fim, ordenadas internamente por investimento desc
  // (assim quem gasta mais sem converter aparece antes dos pequenos zerados).
  ranking.sort((a, b) => {
    const aInf = !Number.isFinite(a.cmql);
    const bInf = !Number.isFinite(b.cmql);
    if (aInf && bInf) return b.investimento - a.investimento;
    if (aInf) return 1;
    if (bInf) return -1;
    return a.cmql - b.cmql;
  });

  // 6. Funil de tráfego (5 etapas) — PRD §5.2.2 "Funil de tráfego"
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
    {
      etapa: "Negócios criados",
      valor: negociosCriados,
      conversaoEtapa: safeRate(negociosCriados, mql),
    },
  ];

  // 7. Funil resumo — snapshot dos totais com métricas secundárias por etapa.
  // null nos secundários quando o denominador é zero (preserva diferença entre "zero" e "indefinido").
  const funilTrafegoResumo: TrafegoFunilResumo = {
    impressoes,
    cliques,
    lpViews,
    leads: leadsCount,
    mql,
    cpm: impressoes > 0 ? (investimento * 1000) / impressoes : null,
    cpc: cliques > 0 ? investimento / cliques : null,
    ctr: impressoes > 0 ? cliques / impressoes : null,
    cpl: leadsCount > 0 ? investimento / leadsCount : null,
    cmql: mql > 0 ? investimento / mql : null,
    txLpLead: lpViews > 0 ? leadsCount / lpViews : null,
  };

  // 8. Conversões — taxas do funil de tráfego (fração 0..1, divisão protegida).
  const conversoesTrafego: TrafegoConversaoTaxa[] = [
    { metrica: "CTR", valor: safeRate(cliques, impressoes) },
    { metrica: "Conexão LP", valor: safeRate(lpViews, cliques) },
    { metrica: "Conversão LP", valor: safeRate(leadsCount, lpViews) },
    { metrica: "Conversão cliques", valor: safeRate(leadsCount, cliques) },
  ];

  // 9. Custos — custo por etapa (R$), reusa os KPIs já calculados.
  const custosTrafego: TrafegoCustoEtapa[] = [
    { metrica: "CPC", valor: cpc },
    { metrica: "CPM", valor: cpm },
    { metrica: "CPL", valor: cpl },
    { metrica: "CMQL", valor: cmql },
    { metrica: "Custo/negócio", valor: custoPorNegocio },
  ];

  return {
    kpis,
    serieCombo,
    mqlCmqlPorFunil,
    mqlPorTemperatura,
    funilTrafego,
    funilTrafegoResumo,
    conversoesTrafego,
    custosTrafego,
    serieConversoesDia,
    serieCustosDia,
    ranking,
  };
}
