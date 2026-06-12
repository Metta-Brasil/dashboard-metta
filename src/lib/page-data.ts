import { cache } from "react";

import { calcAnuncios } from "@/lib/calc/anuncios";
import { calcCloser } from "@/lib/calc/closer";
import { calcInstagram } from "@/lib/calc/instagram";
import { calcMetas } from "@/lib/calc/metas";
import { calcOrigem } from "@/lib/calc/origem";
import { calcSdr } from "@/lib/calc/sdr";
import { calcTpDistribuicao } from "@/lib/calc/tp-distribuicao";
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
    "fb_at",
    "at_ap",
    "at_sala",
    "at_se",
    "at_aph",
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

export const getTpDistribuicao = cache(async (sp: SP) => {
  const f = parseFilters(await sp);
  const spv = await sp;
  const contas =
    typeof spv.conta === "string"
      ? spv.conta
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((x) => x === "metta" || x === "tiago")
      : [];
  const modo =
    typeof spv.modo === "string" && spv.modo === "video" ? "video" : "seguidores";
  const data = await readAllSheets(["fb_todos"]);
  return calcTpDistribuicao(data, { from: f.from, to: f.to, contas, modo });
});

/** Filtros parseados (memoizado) — pro toolbar não re-parsear. */
export const getFilters = cache(async (sp: SP) => parseFilters(await sp));

export const getInstagramMetta = cache(async (sp?: SP) => {
  const spv = sp ? await sp : {};
  const filters = parseFilters(spv);
  const tipos =
    typeof spv.tipos === "string"
      ? spv.tipos.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
  const criterio =
    typeof spv.criterio === "string" &&
    ["views", "er", "alcance"].includes(spv.criterio)
      ? (spv.criterio as "views" | "er" | "alcance")
      : undefined;
  const data = await readAllSheets(["ig_metta_perfil", "ig_metta_posts"]);
  return calcInstagram(
    { profile: data.ig_metta_perfil, posts: data.ig_metta_posts },
    { from: filters.from, to: filters.to, tipos, criterio }
  );
});

export const getInstagramTiago = cache(async (sp?: SP) => {
  const spv = sp ? await sp : {};
  const filters = parseFilters(spv);
  const tipos =
    typeof spv.tipos === "string"
      ? spv.tipos.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
  const criterio =
    typeof spv.criterio === "string" &&
    ["views", "er", "alcance"].includes(spv.criterio)
      ? (spv.criterio as "views" | "er" | "alcance")
      : undefined;
  const data = await readAllSheets(["ig_tiago_perfil", "ig_tiago_posts"]);
  return calcInstagram(
    { profile: data.ig_tiago_perfil, posts: data.ig_tiago_posts },
    { from: filters.from, to: filters.to, tipos, criterio }
  );
});
