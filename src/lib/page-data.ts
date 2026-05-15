import { cache } from "react";

import { calcAnuncios } from "@/lib/calc/anuncios";
import { calcCloser } from "@/lib/calc/closer";
import { calcMetas } from "@/lib/calc/metas";
import { calcOrigem } from "@/lib/calc/origem";
import { calcSdr } from "@/lib/calc/sdr";
import { calcTrafego } from "@/lib/calc/trafego";
import { calcVisaoGeral } from "@/lib/calc/visao-geral";
import { parseFilters } from "@/lib/filters";
import { readAllSheets } from "@/lib/sheets/read";

/**
 * Loaders memoizados por request (React.cache).
 *
 * Problema resolvido: cada página tem N seções em Suspense próprio. Antes,
 * cada seção chamava readAllSheets + calc independente → N fetches de 51k
 * linhas + N cálculos por request (cache stampede).
 *
 * React.cache() memoiza pelo argumento (a Promise `searchParams`). Como
 * todas as seções de uma página recebem a MESMA referência de
 * `searchParams` (vem do mesmo componente Page), o loader roda UMA vez por
 * request e as N seções compartilham o resultado: 1 fetch + 1 calc.
 *
 * O cache persistente (entre requests) continua sendo responsabilidade do
 * `'use cache'` em readAllSheets. Aqui é só dedup intra-request.
 */

type SP = Promise<Record<string, string | string[] | undefined>>;

export const getVisaoGeral = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["fb_todos", "leads", "sdr", "vendas"]);
  return calcVisaoGeral(data, filters);
});

export const getTrafego = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["fb_todos", "leads"]);
  return calcTrafego(data, filters);
});

export const getSdr = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["leads", "sdr", "vendas"]);
  return calcSdr(data, filters);
});

export const getCloser = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "Metas",
  ]);
  return calcCloser(data, filters);
});

export const getAnuncios = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "ads_links",
  ]);
  return calcAnuncios(data, filters);
});

export const getOrigem = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["leads", "sdr", "vendas"]);
  return calcOrigem(data, filters);
});

export const getMetas = cache(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "Metas",
  ]);
  return calcMetas(data, filters);
});

/** Filtros parseados (memoizado) — pro toolbar não re-parsear. */
export const getFilters = cache(async (sp: SP) => parseFilters(await sp));
