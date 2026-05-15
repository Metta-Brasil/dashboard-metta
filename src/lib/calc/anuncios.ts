/**
 * Cálculo da página Anúncios.
 *
 * Join utm_content × fb_todos × vendas. Resultado: top 3 cards por ROAS
 * (com mínimo de investimento) + galeria completa ordenada por investimento.
 */

import {
  extractFunilFromConversao,
  filterByDate,
  filterByFunil,
  normalizeQualif,
  parseData,
  parseValor,
  safeRate,
  sumBy,
} from "./shared";
import type {
  AnuncioCard,
  AnunciosResult,
  FilterState,
  RawData,
  Row,
} from "./types";

const MIN_INVESTIMENTO_TOP_ROAS = 500;

function fbDate(r: Row): Date | null {
  return parseData(r["Day"] ?? r["day"] ?? r["data"] ?? r["Data"]);
}

function fbConversao(r: Row): string | undefined {
  const v =
    r["Conversao"] ?? r["Conversão"] ?? r["conversao"] ?? r["C"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

/** Nome do anúncio (utm_content). TODO: confirmar header real em fb_todos. */
function fbUtmContent(r: Row): string {
  const v =
    r["Ad name"] ??
    r["utm_content"] ??
    r["Anúncio"] ??
    r["Anuncio"] ??
    r["ad_name"] ??
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

/** utm_content vindo do lead. TODO: confirmar header. */
function leadUtmContent(r: Row): string {
  const v =
    r["utm_content"] ?? r["UTM Content"] ?? r["Anúncio"] ?? r["Anuncio"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function vendaDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data fechamento"] ?? r["closed_at"]
  );
}

function vendaFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["K"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function vendaUtmContent(r: Row): string {
  const v =
    r["utm_content"] ?? r["UTM Content"] ?? r["Anúncio"] ?? r["Anuncio"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function vendaValor(r: Row): number {
  return parseValor(
    (r["Valor"] ?? r["valor"] ?? r["Faturamento"] ?? r["amount"]) as
      | string
      | number
      | undefined
  );
}

export function calcAnuncios(
  raw: Pick<RawData, "fbTodos" | "leads" | "vendas">,
  filters: FilterState
): AnunciosResult {
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

  const vendasFiltrado = filterByFunil(
    filterByDate(raw.vendas, vendaDate, from, to),
    vendaFunil,
    funis
  );

  // Agrega por utm_content em cada aba.
  const fbPorContent = new Map<string, Row[]>();
  for (const r of fbFiltrado) {
    const k = fbUtmContent(r) || "—";
    const b = fbPorContent.get(k);
    if (b) b.push(r);
    else fbPorContent.set(k, [r]);
  }

  const mqlPorContent = new Map<string, number>();
  for (const r of mqlRows) {
    const k = leadUtmContent(r) || "—";
    mqlPorContent.set(k, (mqlPorContent.get(k) ?? 0) + 1);
  }

  const vendasPorContent = new Map<string, Row[]>();
  for (const r of vendasFiltrado) {
    const k = vendaUtmContent(r) || "—";
    const b = vendasPorContent.get(k);
    if (b) b.push(r);
    else vendasPorContent.set(k, [r]);
  }

  // Conjunto único de chaves (todos os utm_contents que aparecem em qualquer aba).
  const keys = new Set<string>([
    ...fbPorContent.keys(),
    ...mqlPorContent.keys(),
    ...vendasPorContent.keys(),
  ]);

  const cards: AnuncioCard[] = Array.from(keys).map((k) => {
    const fbRows = fbPorContent.get(k) ?? [];
    const venRows = vendasPorContent.get(k) ?? [];
    const investimento = sumBy(fbRows, fbInvestimento);
    const impressoes = sumBy(fbRows, fbImpressoes);
    const cliques = sumBy(fbRows, fbCliques);
    const mql = mqlPorContent.get(k) ?? 0;
    const vendas = venRows.length;
    const faturamento = sumBy(venRows, vendaValor);
    return {
      utmContent: k,
      nome: k,
      investimento,
      impressoes,
      cliques,
      ctr: safeRate(cliques, impressoes),
      mql,
      vendas,
      faturamento,
      roas: safeRate(faturamento, investimento),
      cpm: safeRate(investimento * 1000, impressoes),
      cmql: safeRate(investimento, mql),
    };
  });

  const galeria = [...cards].sort((a, b) => b.investimento - a.investimento);
  const topRoas = [...cards]
    .filter((c) => c.investimento >= MIN_INVESTIMENTO_TOP_ROAS)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3);

  return { topRoas, galeria };
}
