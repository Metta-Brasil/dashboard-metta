import {
  dedupeLeadsByEmail,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  groupBy,
  isMql,
  safeRate,
  sumBy,
} from "./shared";
import type {
  AnuncioCard,
  AnunciosResult,
  FilterState,
  RawData,
} from "./types";

/**
 * Anúncios — ranking + galeria de criativos.
 * Fonte: PRD §5.2.5 (linhas 2442-2865).
 *
 * Diferença vs PRD: o `AnunciosResult` deste repo expõe { topRoas, galeria }
 * em vez de topCpl/topCmql/topVendas/galeria/tabelaAnuncios. Mantemos a
 * assinatura existente; a página consumidora pode derivar listas adicionais
 * por ordenação do array `galeria`.
 *
 * Unidade de análise: `fb_todos.adName` (cada anúncio é único pelo nome).
 *
 * Joins (substring bidirecional após normalização):
 *   fb_todos.adName ──→ leads.utmContent       (count leads + MQL)
 *                   └─→ vendas.utmContentSnap  (count vendas + faturamento)
 */

/** Investimento mínimo (R$) pra anúncio entrar em "topRoas". Evita ROAS infinito de criativo zerado. */
const TOP_ROAS_MIN_INVEST = 500;

/** Limite de cards na galeria (PRD §5.2.5 — 12 cards, paginação v2). */
const GALERIA_LIMIT = 12;

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "_").trim();
}

/** Substring match bidirecional após normalização — tolera case/espaços e UTMs truncados. */
function utmMatchesAd(utmContent: string, adName: string): boolean {
  if (!utmContent || !adName) return false;
  const u = normalizeForMatch(utmContent);
  const a = normalizeForMatch(adName);
  if (!u || !a) return false;
  return u === a || u.includes(a) || a.includes(u);
}

export function calcAnuncios(
  data: Pick<RawData, "fb_todos" | "leads" | "vendas">,
  filters: FilterState
): AnunciosResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base (funil + período).
  const fbF = filterFbTodosByFunil(data.fb_todos, funis);
  const fbInRange = filterByDate(fbF, (r) => r.day, filters.from, filters.to);

  const leadsF = filterLeadsByFunil(data.leads, funis);
  const leadsInRange = filterByDate(
    leadsF,
    (r) => r.dataInscricao,
    filters.from,
    filters.to
  );
  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);

  const vendasF = filterVendasByFunil(data.vendas, funis);
  const vendasInRange = filterByDate(
    vendasF,
    (r) => r.dataCompra,
    filters.from,
    filters.to
  );

  // 2. Agrupar fb_todos por adName (unidade de análise).
  const fbByAd = groupBy(fbInRange, (r) => r.adName);

  // 3. Pra cada anúncio: somar tráfego + cruzar downstream via utm_content.
  const cards: AnuncioCard[] = [];
  for (const [adName, rows] of fbByAd.entries()) {
    if (!adName) continue;

    const investimento = sumBy(rows, (r) => r.amountSpent);
    const impressoes = sumBy(rows, (r) => r.impressions);
    const cliques = sumBy(rows, (r) => r.linkClicks);

    const leadsDoAd = leadsUnicos.filter((l) =>
      utmMatchesAd(l.utmContent, adName)
    );
    const mql = leadsDoAd.filter((l) => isMql(l.qualificacao)).length;

    const vendasDoAd = vendasInRange.filter((v) =>
      utmMatchesAd(v.utmContentSnap, adName)
    );
    const vendasCount = vendasDoAd.length;
    const faturamento = sumBy(vendasDoAd, (v) => v.valorContrato);

    cards.push({
      utmContent: adName,
      nome: adName,
      investimento,
      impressoes,
      cliques,
      ctr: safeRate(cliques, impressoes),
      mql,
      vendas: vendasCount,
      faturamento,
      roas: safeRate(faturamento, investimento),
      cpm: impressoes > 0 ? (investimento * 1000) / impressoes : 0,
      cmql: safeRate(investimento, mql),
    });
  }

  // 4. Top por ROAS — corte de investimento mínimo (R$ 500) + venda > 0
  //    pra ROAS faça sentido (sem isso, qualquer criativo com 1 venda
  //    e baixo invest vira "campeão" estatisticamente irrelevante).
  const topRoas = [...cards]
    .filter((c) => c.investimento >= TOP_ROAS_MIN_INVEST && c.vendas > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3);

  // 5. Galeria — todos com atividade no período (Invest > 0 OU Leads > 0),
  //    ordenada por CMQL ascendente (anúncios sem MQL no fim).
  //    PRD §5.2.5: limite v1 = 12.
  const galeria = cards
    .filter((c) => c.investimento > 0 || c.mql > 0)
    .sort((a, b) => {
      const aHasMql = a.mql > 0;
      const bHasMql = b.mql > 0;
      if (aHasMql && !bHasMql) return -1;
      if (!aHasMql && bHasMql) return 1;
      return a.cmql - b.cmql;
    })
    .slice(0, GALERIA_LIMIT);

  return { topRoas, galeria };
}
