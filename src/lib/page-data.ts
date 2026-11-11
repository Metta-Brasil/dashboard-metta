import { cache } from "react";

import { calcAnuncios } from "@/lib/calc/anuncios";
import { calcAtividades, parseAtvVisao } from "@/lib/calc/atividades";
import { listClintTags, mergeClint } from "@/lib/calc/clint";
import { calcCloser } from "@/lib/calc/closer";
import { calcInstagram } from "@/lib/calc/instagram";
import { calcMetas } from "@/lib/calc/metas";
import { calcOrigem } from "@/lib/calc/origem";
import { calcResgate } from "@/lib/calc/resgate";
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

/**
 * `React.cache` + memo pela identidade da promise `searchParams`.
 *
 * O `React.cache` só memoiza dentro de um render do React. O MCP
 * (`src/lib/mcp`) chama estas MESMAS funções fora de um render — executa a
 * árvore da página por conta própria para serializá-la — e lá o
 * `React.cache` vira passagem direta: cada seção releria as abas e
 * recalcularia tudo. O WeakMap fecha essa diferença sem mudar o contrato:
 * a chave é a mesma promise que as seções de uma página já compartilham,
 * some junto com a requisição e nunca cruza requisições.
 */
function porRequest<R>(fn: (sp: SP) => Promise<R>): (sp: SP) => Promise<R> {
  const cached = cache(fn);
  const memo = new WeakMap<SP, Promise<R>>();
  return (sp) => {
    let hit = memo.get(sp);
    if (!hit) {
      hit = cached(sp);
      memo.set(sp, hit);
    }
    return hit;
  };
}

export const getVisaoGeral = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["fb_todos", "leads", "sdr", "vendas", "clint"]);
  return calcVisaoGeral(mergeClint(data, filters), filters);
});

export const getTrafego = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["fb_todos", "leads", "clint"]);
  return calcTrafego(mergeClint(data, filters), filters);
});

export const getSdr = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["leads", "sdr", "vendas", "clint"]);
  return calcSdr(mergeClint(data, filters), filters);
});

export const getCloser = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "clint",
    "Metas",
  ]);
  return calcCloser(mergeClint(data, filters), filters);
});

export const getAnuncios = porRequest(async (sp: SP) => {
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
    "clint",
  ]);
  return calcAnuncios(mergeClint(data, filters), filters);
});

export const getOrigem = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["leads", "sdr", "vendas", "clint"]);
  return calcOrigem(mergeClint(data, filters), filters);
});

export const getMetas = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "clint",
    "Metas",
  ]);
  return calcMetas(mergeClint(data, filters), filters);
});

export const getTpDistribuicao = porRequest(async (sp: SP) => {
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
  const data = await readAllSheets(["fb_todos", "ig_impulsionados_hist"]);
  return calcTpDistribuicao(data, { from: f.from, to: f.to, contas, modo });
});

/**
 * Inventário de tags da Clint pro filtro "Tags Clint" do toolbar.
 * De propósito NÃO passa por parseFilters: a lista de opções tem que ser
 * a completa (sem corte de tag nem de período), senão a tag selecionada
 * sumiria da lista e ficaria impossível desmarcar.
 */
export const getClintTags = cache(async () => {
  const data = await readAllSheets(["clint"]);
  return listClintTags(data);
});

/** Filtros parseados (memoizado) — pro toolbar não re-parsear. */
export const getFilters = porRequest(async (sp: SP) => parseFilters(await sp));

export const getInstagramMetta = cache(async (sp?: SP) => {
  const spv = sp ? await sp : {};
  const filters = parseFilters(spv);
  const criterio =
    typeof spv.criterio === "string" &&
    ["views", "er", "alcance"].includes(spv.criterio)
      ? (spv.criterio as "views" | "er" | "alcance")
      : undefined;
  const data = await readAllSheets([
    "ig_metta_perfil",
    "ig_metta_posts",
    "ig_metta_demograficos",
    "ig_metta_stories",
  ]);
  return calcInstagram(
    {
      profile: data.ig_metta_perfil,
      posts: data.ig_metta_posts,
      demograficos: data.ig_metta_demograficos,
      stories: data.ig_metta_stories,
    },
    { from: filters.from, to: filters.to, criterio }
  );
});

/** Página unificada /instagram: escolhe a conta pelo param `conta`. */
export const getInstagramConta = porRequest(async (sp: SP) => {
  const spv = await sp;
  return spv.conta === "tiago" ? getInstagramTiago(sp) : getInstagramMetta(sp);
});

export const getInstagramTiago = cache(async (sp?: SP) => {
  const spv = sp ? await sp : {};
  const filters = parseFilters(spv);
  const criterio =
    typeof spv.criterio === "string" &&
    ["views", "er", "alcance"].includes(spv.criterio)
      ? (spv.criterio as "views" | "er" | "alcance")
      : undefined;
  const data = await readAllSheets([
    "ig_tiago_perfil",
    "ig_tiago_posts",
    "ig_tiago_demograficos",
    "ig_tiago_stories",
  ]);
  return calcInstagram(
    {
      profile: data.ig_tiago_perfil,
      posts: data.ig_tiago_posts,
      demograficos: data.ig_tiago_demograficos,
      stories: data.ig_tiago_stories,
    },
    { from: filters.from, to: filters.to, criterio }
  );
});

/**
 * Funil de Resgate — pipeline "Operação Resgate · Reativação de Base".
 * Só a aba `clint`: não há mídia nem investimento atrelados. De propósito
 * NÃO passa por `mergeClint` — esses negócios são base antiga reaquecida,
 * não podem entrar nas métricas de SDR/Closer/Metas como lead novo.
 */
export const getResgate = porRequest(async (sp: SP) => {
  const filters = parseFilters(await sp);
  const data = await readAllSheets(["clint"]);
  return calcResgate(data, { from: filters.from, to: filters.to });
});

/**
 * Comercial Atividades — ações do comercial por dia (ligações, mensagens,
 * agendamentos, etapas e atividades), da planilha de atividades do Clint.
 * A aba `clint` entra só para o nome atual das pipelines e para "leads por
 * etapa hoje". De propósito NÃO passa por `mergeClint` nem pelos filtros de
 * funil/tags: aqui o recorte é a pipeline, não o funil pago.
 */
export const getAtividades = porRequest(async (sp: SP) => {
  const spv = await sp;
  const filters = parseFilters(spv);
  // Params próprios (`pessoa`, `canal`), e não o `sdr` das outras páginas: o
  // menu leva a query string de uma página para a outra, e os nomes daqui
  // (usuário do Clint ou dono do canal) não são os mesmos do filtro de SDR.
  const lista = (v: string | string[] | undefined): string[] =>
    typeof v === "string"
      ? v
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c !== "")
      : [];
  const data = await readAllSheets([
    "atv_contatos",
    "atv_acoes",
    "atv_etapas",
    "atv_atividades",
    "clint",
  ]);
  return calcAtividades(data, {
    from: filters.from,
    to: filters.to,
    visao: parseAtvVisao(spv.pipeline),
    pessoas: lista(spv.pessoa),
    canais: lista(spv.canal),
  });
});
