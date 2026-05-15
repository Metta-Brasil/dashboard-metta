import {
  dedupeLeadsByEmail,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  groupBy,
  isMql,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  AdsLinkRow,
  AnuncioCard,
  AnunciosResult,
  FbTodosRow,
  FilterState,
  LeadRow,
  RawData,
  SdrRow,
  VendaRow,
} from "./types";

/**
 * Anúncios — ranking + galeria de criativos.
 * Fonte: PRD §5.2.5 + docs/inventario-completude.md (linhas 556-676).
 *
 * Unidade de análise: `fb_todos.adName` (cada anúncio é único pelo nome).
 *
 * Joins (substring bidirecional após normalização):
 *   fb_todos.adName ──→ leads.utmContent       (count leads + MQL)
 *                   ├─→ sdr.utmContentSnap     (agendamentos + reuniões)
 *                   ├─→ vendas.utmContentSnap  (count vendas + faturamento)
 *                   └─→ ads_links.adName       (thumbnail + IG permalink, exato/substring)
 */

/** Investimento mínimo (R$) pra anúncio entrar em "topRoas" (legado).
 *  Evita ROAS infinito de criativo zerado. */
const TOP_ROAS_MIN_INVEST = 500;

/** Limite de cards na galeria (PRD §5.2.5 — 12 cards, paginação v2). */
const GALERIA_LIMIT = 12;

/** Normalização robusta: lowercase, remove acentos, espaços/hífens → "_",
 *  colapsa "_" repetidos, trim. Permite casar "Empresário quer..." (adName)
 *  com "Empresario_quer..." (utm_content) sem falso-positivo de substring. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
}

/** Match EXATO normalizado (NÃO substring).
 *
 * O substring bidirecional anterior (`a.includes(b) || b.includes(a)`)
 * causava contaminação massiva: ~437/2490 adNames colidiam entre si por
 * prefixo, fazendo cada anúncio "roubar" leads/vendas de outros (inclusive
 * de outros funis). 71,9% dos leads casam por igualdade exata normalizada
 * — esse é o vínculo real `utm_content == adName`. */
function utmMatchesAd(utmContent: string, adName: string): boolean {
  if (!utmContent || !adName) return false;
  const u = normalizeForMatch(utmContent);
  const a = normalizeForMatch(adName);
  return u !== "" && u === a;
}

/** O registro pertence ao anúncio NAQUELA campanha (logo, naquele funil):
 *  utm_campaign do lead/sdr/venda tem que ser uma das campanhas em que o
 *  adName rodou no recorte filtrado. Impede que o mesmo criativo reusado
 *  em campanhas/funis diferentes misture métricas. */
function utmCampaignInSet(
  utmCampaign: string,
  campNormSet: Set<string>
): boolean {
  if (!utmCampaign) return false;
  return campNormSet.has(normalizeForMatch(utmCampaign));
}

/** Lookup em ads_links por adName — match exato (normalizado) ou substring bidirecional.
 *  Retorna { thumbnailUrl, instagramPermalink } com strings vazias se não achar. */
function lookupAdsLink(
  adName: string,
  adsLinks: AdsLinkRow[] | undefined
): { thumbnailUrl: string; instagramPermalink: string } {
  if (!adsLinks || adsLinks.length === 0) {
    return { thumbnailUrl: "", instagramPermalink: "" };
  }
  const target = normalizeForMatch(adName);
  if (!target) return { thumbnailUrl: "", instagramPermalink: "" };

  // 1ª passada: match exato (normalizado).
  for (const link of adsLinks) {
    if (normalizeForMatch(link.adName) === target) {
      return {
        thumbnailUrl: link.imageUrl ?? "",
        instagramPermalink: link.instagramPermalink ?? "",
      };
    }
  }
  // 2ª passada: substring bidirecional.
  for (const link of adsLinks) {
    const n = normalizeForMatch(link.adName);
    if (!n) continue;
    if (n.includes(target) || target.includes(n)) {
      return {
        thumbnailUrl: link.imageUrl ?? "",
        instagramPermalink: link.instagramPermalink ?? "",
      };
    }
  }
  return { thumbnailUrl: "", instagramPermalink: "" };
}

export function calcAnuncios(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "ads_links">,
  filters: FilterState
): AnunciosResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base (funil + período).
  let fbF: FbTodosRow[] = filterFbTodosByFunil(data.fb_todos, funis);

  // Filtro temperatura: PRD não define markers explícitos em campaignName
  // (Frio/Quente/Advantage). Skipamos quando != "todas" até termos confirmação
  // dos markers reais — alternativa seria filtrar zero linhas e quebrar a página.
  // TODO(PRD §5.2.5 temperatura): aplicar marker correto em campaignName
  // assim que documentado. Por ora, ignora o filtro.
  if (filters.temperatura && filters.temperatura !== "todas") {
    // no-op consciente — vide TODO acima.
  }

  const fbInRange: FbTodosRow[] = filterByDate(
    fbF,
    (r) => r.day,
    filters.from,
    filters.to
  );

  const leadsF: LeadRow[] = filterLeadsByFunil(data.leads, funis);
  const leadsInRange: LeadRow[] = filterByDate(
    leadsF,
    (r) => r.dataInscricao,
    filters.from,
    filters.to
  );
  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);

  const vendasF: VendaRow[] = filterVendasByFunil(data.vendas, funis);
  const vendasInRange: VendaRow[] = filterByDate(
    vendasF,
    (r) => r.dataCompra,
    filters.from,
    filters.to
  );

  // SDR: dois recortes — um por dataAgendamento (agendamentos)
  // e outro por dataReuniao (reuniões agendadas / realizadas).
  // Não filtramos SDR por funil (utmContentSnap já amarra ao adName).
  const sdrSrc: SdrRow[] = data.sdr ?? [];
  const sdrByAgendamento: SdrRow[] = filterByDate(
    sdrSrc,
    (r) => r.dataAgendamento,
    filters.from,
    filters.to
  );
  const sdrByReuniao: SdrRow[] = filterByDate(
    sdrSrc,
    (r) => r.dataReuniao,
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
    const lpViews = sumBy(rows, (r) => r.landingPageViews);

    // Campanhas em que ESTE anúncio rodou no recorte filtrado. O downstream
    // (lead/sdr/venda) só conta se utm_content == adName E utm_campaign for
    // uma dessas campanhas — amarra ao funil correto e evita que o mesmo
    // criativo reusado em campanhas/funis diferentes misture métricas.
    const campNormSet = new Set(
      rows.map((r) => normalizeForMatch(r.campaignName)).filter(Boolean)
    );

    const leadsDoAd = leadsUnicos.filter(
      (l) =>
        utmMatchesAd(l.utmContent, adName) &&
        utmCampaignInSet(l.utmCampaign, campNormSet)
    );
    const leadsCount = leadsDoAd.length;
    const mql = leadsDoAd.filter((l) => isMql(l.qualificacao)).length;

    const sdrAgendDoAd = sdrByAgendamento.filter(
      (s) =>
        utmMatchesAd(s.utmContentSnap, adName) &&
        utmCampaignInSet(s.utmCampaignSnap, campNormSet)
    );
    const sdrReunDoAd = sdrByReuniao.filter(
      (s) =>
        utmMatchesAd(s.utmContentSnap, adName) &&
        utmCampaignInSet(s.utmCampaignSnap, campNormSet)
    );
    const agendamentos = sdrAgendDoAd.length;
    const reunioesAgendadas = sdrReunDoAd.length;
    const reunioesRealizadas = sdrReunDoAd.filter((s) =>
      isReuniaoRealizada(s.status)
    ).length;

    const vendasDoAd = vendasInRange.filter(
      (v) =>
        utmMatchesAd(v.utmContentSnap, adName) &&
        utmCampaignInSet(v.utmCampaignSnap, campNormSet)
    );
    const vendasCount = vendasDoAd.length;
    const faturamento = sumBy(vendasDoAd, (v) => v.valorContrato);

    const { thumbnailUrl, instagramPermalink } = lookupAdsLink(
      adName,
      data.ads_links
    );

    cards.push({
      adName,
      investimento,
      impressoes,
      cliques,
      lpViews,
      ctr: safeRate(cliques, impressoes),
      cpc: safeRate(investimento, cliques),
      cpm: impressoes > 0 ? (investimento * 1000) / impressoes : 0,
      leads: leadsCount,
      cpl: safeRate(investimento, leadsCount),
      mql,
      cmql: safeRate(investimento, mql),
      agendamentos,
      reunioesAgendadas,
      reunioesRealizadas,
      vendas: vendasCount,
      faturamento,
      roas: safeRate(faturamento, investimento),
      thumbnailUrl,
      instagramPermalink,
    });
  }

  // 4. Listas "Top por…".
  const topCpl = [...cards]
    .filter((c) => c.leads > 0)
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 3);

  const topCmql = [...cards]
    .filter((c) => c.mql > 0)
    .sort((a, b) => a.cmql - b.cmql)
    .slice(0, 3);

  const topVendas = [...cards]
    .filter((c) => c.vendas > 0)
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, 3);

  // Legado: corte de investimento mínimo (R$ 500) + venda > 0 pra ROAS
  // fazer sentido (sem isso, qualquer criativo com 1 venda e baixo invest
  // vira "campeão" estatisticamente irrelevante).
  const topRoas = [...cards]
    .filter((c) => c.investimento >= TOP_ROAS_MIN_INVEST && c.vendas > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3);

  // 5. Galeria — até 12 cards com atividade (invest > 0 OU mql > 0).
  //    Prioriza quem tem thumbnail, depois por investimento DESC.
  const galeria = cards
    .filter((c) => c.investimento > 0 || c.mql > 0)
    .sort((a, b) => {
      const aThumb = a.thumbnailUrl ? 1 : 0;
      const bThumb = b.thumbnailUrl ? 1 : 0;
      if (aThumb !== bThumb) return bThumb - aThumb;
      return b.investimento - a.investimento;
    })
    .slice(0, GALERIA_LIMIT);

  // 6. Tabela completa — todos com atividade (sem limite),
  //    ordenação default por CMQL ASC (zerados no fim).
  const tabelaAnuncios = cards
    .filter((c) => c.investimento > 0 || c.leads > 0 || c.mql > 0)
    .sort((a, b) => {
      const aHasMql = a.mql > 0;
      const bHasMql = b.mql > 0;
      if (aHasMql && !bHasMql) return -1;
      if (!aHasMql && bHasMql) return 1;
      return a.cmql - b.cmql;
    });

  return {
    topCpl,
    topCmql,
    topVendas,
    galeria,
    tabelaAnuncios,
    topRoas,
  };
}
