import {
  filterByDate,
  isMql,
  isReuniaoRealizada,
  safeRate,
  type RowSource,
} from "./shared";
import { clintRows } from "./clint";
import type {
  AdsLinkRow,
  AnuncioCard,
  AnunciosResult,
  AtLeadRow,
  FbAtRow,
  FilterState,
  Funil,
  RawData,
  SdrRow,
  VendaRow,
} from "./types";

/**
 * Anúncios — replica EXATA do relatório "Análise Tráfego" da planilha
 * (validado ao centavo: Sessão 01/03→31/05 = R$35.498,49 / 250 leads /
 * 243 MQL; PP-SE-718 = 100 / 94).
 *
 * Modelo da planilha (≠ join utm_content do legado):
 *  - Universo de anúncios: aba `fb` — Day no range, Campaign contém o
 *    marcador do funil (FIND, case-SENSITIVE), Impressions > 0.
 *  - Spend/Impr/Cliques/LPViews: SUMIFS na aba `fb` (Campaign contém
 *    marcador, case-insensitive; Ad == nome do anúncio).
 *  - Leads/MQL: COUNTIFS somando as abas `ap` + `sala` + `se` +
 *    `aplicação hubspot` (data no range, Campaign contém marcador,
 *    coluna de Ad == nome do anúncio; MQL = qualif "MQL"|"Inter").
 *  - Agend/Reuniões/Vendas: NÃO existem no relatório da planilha —
 *    mantidos via join utm_content↔adName (sdr/vendas), best-effort,
 *    sem número da planilha pra contradizer.
 */

const GALERIA_LIMIT = 6;

/** Marcador de campanha por funil (token na Campaign Name). */
const FUNIL_AT_MARKER: Record<Exclude<Funil, "todos">, string> = {
  sala: "SALA",
  aplica: "APLICA",
  sessao: "SESSAO",
  isca: "ISCA",
  reality: "REALITY",
};

function markersFor(funis: Funil[] | undefined): string[] {
  const fs = funis && funis.length ? funis : ["todos"];
  if (fs.includes("todos")) return Object.values(FUNIL_AT_MARKER);
  return fs
    .filter((f): f is Exclude<Funil, "todos"> => f !== "todos")
    .map((f) => FUNIL_AT_MARKER[f]);
}

/** Chave de anúncio = nome exato trimado (igual ao COUNTIFS da planilha). */
const adKey = (s: string): string => String(s ?? "").trim();

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
function utmMatchesAd(utmContent: string, adName: string): boolean {
  if (!utmContent || !adName) return false;
  const u = normalizeForMatch(utmContent);
  const a = normalizeForMatch(adName);
  return u !== "" && u === a;
}
function utmCampaignInSet(
  utmCampaign: string,
  campNormSet: Set<string>
): boolean {
  if (!utmCampaign) return false;
  return campNormSet.has(normalizeForMatch(utmCampaign));
}

function lookupAdsLink(
  adName: string,
  adsLinks: AdsLinkRow[] | undefined
): { thumbnailUrl: string; instagramPermalink: string } {
  if (!adsLinks || adsLinks.length === 0) {
    return { thumbnailUrl: "", instagramPermalink: "" };
  }
  const target = normalizeForMatch(adName);
  if (!target) return { thumbnailUrl: "", instagramPermalink: "" };
  for (const link of adsLinks) {
    if (normalizeForMatch(link.adName) === target) {
      return {
        thumbnailUrl: link.imageUrl ?? "",
        instagramPermalink: link.instagramPermalink ?? "",
      };
    }
  }
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
  data: Pick<
    RawData,
    | "sdr"
    | "vendas"
    | "clint"
    | "ads_links"
    | "fb_at"
    | "at_ap"
    | "at_sala"
    | "at_se"
    | "at_aph"
  >,
  filters: FilterState
): AnunciosResult {
  const markers = markersFor(filters.funis);
  // Campaign contém marcador — case-SENSITIVE (FIND) p/ a lista de
  // anúncios; case-insensitive p/ os somatórios (SUMIFS/COUNTIFS).
  const campCS = (c: string) => markers.some((m) => c.includes(m));
  const campCI = (c: string) => {
    const u = c.toUpperCase();
    return markers.some((m) => u.includes(m));
  };

  const fbAll: FbAtRow[] = data.fb_at ?? [];
  const fbInRange = filterByDate(fbAll, (r) => r.day, filters.from, filters.to);

  // 1. Universo de anúncios (B7): Campaign FIND(marcador) + Impressions>0.
  const adSet = new Set<string>();
  for (const r of fbInRange) {
    if (campCS(r.campaignName) && r.impressions > 0) {
      const k = adKey(r.adName);
      if (k) adSet.add(k);
    }
  }

  type Agg = {
    investimento: number;
    impressoes: number;
    cliques: number;
    lpViews: number;
    leads: number;
    mql: number;
    camps: Set<string>;
  };
  const byAd = new Map<string, Agg>();
  const ensure = (k: string): Agg => {
    let a = byAd.get(k);
    if (!a) {
      a = {
        investimento: 0,
        impressoes: 0,
        cliques: 0,
        lpViews: 0,
        leads: 0,
        mql: 0,
        camps: new Set<string>(),
      };
      byAd.set(k, a);
    }
    return a;
  };

  // 2. Spend/Impr/Cliques/LPViews (SUMIFS aba fb, Campaign CI marcador).
  for (const r of fbInRange) {
    if (!campCI(r.campaignName)) continue;
    const k = adKey(r.adName);
    if (!adSet.has(k)) continue;
    const a = ensure(k);
    a.investimento += r.amountSpent;
    a.impressoes += r.impressions;
    a.cliques += r.linkClicks;
    a.lpViews += r.landingPageViews;
    const cn = normalizeForMatch(r.campaignName);
    if (cn) a.camps.add(cn);
  }

  // 3. Leads/MQL (COUNTIFS abas ap/sala/se/aplicação hubspot).
  const leadSheets: AtLeadRow[][] = [
    data.at_ap ?? [],
    data.at_sala ?? [],
    data.at_se ?? [],
    data.at_aph ?? [],
  ];
  for (const sheet of leadSheets) {
    const inRange = filterByDate(
      sheet,
      (r) => r.data,
      filters.from,
      filters.to
    );
    for (const r of inRange) {
      if (!campCI(r.campaignName)) continue;
      const k = adKey(r.adName);
      if (!adSet.has(k)) continue;
      const a = ensure(k);
      a.leads += 1;
      if (isMql(r.qualificacao)) a.mql += 1;
    }
  }

  // 4. Agend/Reuniões/Vendas — sem oracle na planilha; join utm legado.
  const sdrSrc: SdrRow[] = data.sdr ?? [];
  const sdrByAgend = filterByDate(
    sdrSrc,
    (r) => r.dataAgendamento,
    filters.from,
    filters.to
  );
  const sdrByReuniao = filterByDate(
    sdrSrc,
    (r) => r.dataReuniao,
    filters.from,
    filters.to
  );
  const vendasSrc: VendaRow[] = data.vendas ?? [];
  const vendasInRange = filterByDate(
    vendasSrc,
    (r) => r.dataCompra,
    filters.from,
    filters.to
  );

  // Negócios criados (Clint, jul+) por data de criação — atribuídos por UTM.
  const clintInRange = filterByDate(
    clintRows(data).map((c) => ({ ...c, _src: "clint" as RowSource })),
    (r) => r.dataCriacao,
    filters.from,
    filters.to
  );

  const cards: AnuncioCard[] = [];
  for (const [adName, a] of byAd.entries()) {
    if (!adName) continue;
    const camps = a.camps;
    const matchUtm = (uc: string, ucamp: string) =>
      utmMatchesAd(uc, adName) && utmCampaignInSet(ucamp, camps);

    const agend = sdrByAgend.filter((s) =>
      matchUtm(s.utmContentSnap, s.utmCampaignSnap)
    ).length;
    const reunRows = sdrByReuniao.filter((s) =>
      matchUtm(s.utmContentSnap, s.utmCampaignSnap)
    );
    const reunioesAgendadas = reunRows.length;
    const reunioesRealizadas = reunRows.filter((s) =>
      isReuniaoRealizada(s.status)
    ).length;
    const vendasDoAd = vendasInRange.filter((v) =>
      matchUtm(v.utmContentSnap, v.utmCampaignSnap)
    );
    const faturamento = vendasDoAd.reduce((s, v) => s + v.valorContrato, 0);
    const negociosCriados = clintInRange.filter((c) =>
      matchUtm(c.utmContent, c.utmCampaign)
    ).length;

    const { thumbnailUrl, instagramPermalink } = lookupAdsLink(
      adName,
      data.ads_links
    );

    cards.push({
      adName,
      investimento: a.investimento,
      impressoes: a.impressoes,
      cliques: a.cliques,
      lpViews: a.lpViews,
      ctr: safeRate(a.cliques, a.impressoes),
      cpc: safeRate(a.investimento, a.cliques),
      cpm: a.impressoes > 0 ? (a.investimento * 1000) / a.impressoes : 0,
      leads: a.leads,
      cpl: safeRate(a.investimento, a.leads),
      mql: a.mql,
      cmql: safeRate(a.investimento, a.mql),
      negociosCriados,
      custoPorNegocio: safeRate(a.investimento, negociosCriados),
      mqlParaNegocio: safeRate(negociosCriados, a.mql),
      agendamentos: agend,
      reunioesAgendadas,
      reunioesRealizadas,
      vendas: vendasDoAd.length,
      faturamento,
      roas: safeRate(faturamento, a.investimento),
      thumbnailUrl,
      instagramPermalink,
    });
  }

  const byVendasThenName = (x: AnuncioCard, y: AnuncioCard): number => {
    if (y.vendas !== x.vendas) return y.vendas - x.vendas;
    return x.adName.localeCompare(y.adName);
  };

  const topNegocios = [...cards]
    .filter((c) => c.negociosCriados > 0)
    .sort((x, y) => y.negociosCriados - x.negociosCriados || byVendasThenName(x, y))
    .slice(0, 3);
  const topAgendamento = [...cards]
    .filter((c) => c.agendamentos > 0)
    .sort((x, y) => y.agendamentos - x.agendamentos || byVendasThenName(x, y))
    .slice(0, 3);
  const topReunioesRealizadas = [...cards]
    .filter((c) => c.reunioesRealizadas > 0)
    .sort(
      (x, y) =>
        y.reunioesRealizadas - x.reunioesRealizadas || byVendasThenName(x, y)
    )
    .slice(0, 3);
  const topRoas = [...cards]
    .filter((c) => c.investimento >= 500 && c.vendas > 0)
    .sort((x, y) => y.roas - x.roas)
    .slice(0, 3);

  const galeria = cards
    .filter((c) => c.investimento > 0 || c.mql > 0)
    .sort((x, y) => y.mql - x.mql || byVendasThenName(x, y))
    .slice(0, GALERIA_LIMIT);

  const tabelaAnuncios = cards
    .filter((c) => c.investimento > 0 || c.leads > 0 || c.mql > 0)
    .sort((x, y) => {
      const xm = x.mql > 0;
      const ym = y.mql > 0;
      if (xm && !ym) return -1;
      if (!xm && ym) return 1;
      return x.cmql - y.cmql;
    });

  return {
    topNegocios,
    topAgendamento,
    topReunioesRealizadas,
    galeria,
    tabelaAnuncios,
    topRoas,
  };
}
