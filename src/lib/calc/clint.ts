import type { ClintRow, SdrRow, VendaRow } from "@/lib/sheets/schemas";
import type { FilterState, RawData } from "@/lib/calc/types";
import { filterByDate, MIGRACAO_CLINT_CUTOFF_TS, type RowSource } from "@/lib/calc/shared";

/**
 * Adapter da migração Clint.
 *
 * A aba `clint` traz negócios do CRM Clint (jul/2026+). Aqui ela é
 * normalizada para os formatos legados `SdrRow` e `VendaRow`, de modo que
 * TODA a lógica de cálculo existente (calc/*.ts) siga funcionando sem saber
 * de onde o dado veio. O corte temporal (legado até 30/jun, Clint jul+) é
 * aplicado em `filterByDate` via o marcador `_src`.
 *
 * Composição de etapas (validada com o cliente, vocabulário normalizado da
 * aba `clint`):
 *  - Reunião realizada  = Reunião realizada + Proposta enviada + Proposta
 *                          aceita + Lead em Relacionamento + Negócio fechado
 *  - Proposta enviada   = Proposta enviada + Proposta aceita + Lead em
 *                          Relacionamento + Negócio fechado
 *  - Venda              = Negócio fechado (linha com Data da venda)
 * Cada métrica é "travada" pela presença da sua data-guia (criação/reunião/
 * venda) no eixo correspondente.
 *
 * Só linhas de Fonte = "Clint" entram; o dump histórico "HubsSpot" (até
 * maio) é ignorado — esse período já vem das abas sdr/vendas.
 */

type Sourced<T> = T & { _src: RowSource };

const norm = (s: string): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Etapa que implica reunião realizada (a própria + todas as seguintes). */
const RE_REALIZADA = /realizada|proposta|relacionamento|fechado/;
/** Etapa que implica proposta enviada (a própria + todas as seguintes). */
const RE_PROPOSTA = /proposta|relacionamento|fechado/;

export function isFonteClint(c: ClintRow): boolean {
  return /clint/i.test(c.fonte);
}

/** Só as linhas nativas do Clint. */
export function clintRows(data: { clint?: ClintRow[] }): ClintRow[] {
  return (data.clint ?? []).filter(isFonteClint);
}

// ----- Tags ------------------------------------------------------------------

/**
 * Sentinela do negócio sem nenhuma tag. Existe pra que o filtro consiga
 * expressar "só os sem tag" / "tira os sem tag" — 342 negócios hoje.
 */
export const SEM_TAG = "__sem_tag__";

/**
 * A coluna `Tag` da aba `clint` traz TODAS as tags do negócio numa string
 * separada por vírgula ("Sessão estratégica, MQL 1, Resgate Julho").
 * Quebra em tags atômicas; sem nenhuma → [SEM_TAG].
 */
export function splitTags(raw: string): string[] {
  const parts = (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
  return parts.length ? parts : [SEM_TAG];
}

const normTag = (t: string): string => (t ?? "").trim().toLowerCase();

/**
 * Aplica o filtro de tags às linhas da aba `clint`.
 *  - "remover" (default): descarta quem tem QUALQUER uma das selecionadas.
 *  - "somente": mantém só quem tem QUALQUER uma das selecionadas.
 * Sem tags selecionadas → passa reto (nenhuma cópia do array).
 */
export function filterClintByTags(
  rows: ClintRow[],
  filters?: Pick<FilterState, "tags" | "tagsMode">
): ClintRow[] {
  const sel = filters?.tags;
  if (!sel?.length) return rows;
  const wanted = new Set(sel.map(normTag));
  const somente = filters?.tagsMode === "somente";
  return rows.filter((r) => {
    const hit = splitTags(r.tag).some((t) => wanted.has(normTag(t)));
    return somente ? hit : !hit;
  });
}

/**
 * Inventário de tags atômicas das linhas nativas do Clint, com contagem.
 * Alimenta as opções do filtro "Tags Clint" — por isso roda sempre sobre
 * o dado SEM filtro (senão a tag some da lista ao ser selecionada).
 */
export function listClintTags(data: {
  clint?: ClintRow[];
}): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of clintRows(data)) {
    for (const t of splitTags(r.tag)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR")
  );
}

/** Normaliza um negócio Clint para o formato da aba `sdr`. */
function toSdr(c: ClintRow): Sourced<SdrRow> {
  const etapa = norm(c.etapa);
  const realizada = RE_REALIZADA.test(etapa);
  const proposta = RE_PROPOSTA.test(etapa);
  return {
    dataAgendamento: c.dataReuniao,
    dataReuniao: c.dataReuniao,
    quemAgendou: c.sdr,
    responsavel: c.closer,
    qualificacaoSdr: c.qualificacao,
    lead: c.nome,
    cargo: c.cargo,
    email: c.email,
    origem: "",
    funil: c.funil,
    status: realizada ? "Reunião realizada" : "Reunião agendada",
    envioProposta: proposta ? "Sim" : "",
    valorProposta: c.valor,
    horarioReuniao: c.hora,
    dataInscricaoSnap: null,
    nomeSnap: c.nome,
    telefoneSnap: "",
    cargoSnap: c.cargo,
    faturamentoSnap: c.faturamento,
    segmentoSnap: c.segmento,
    qualificacaoSnap: c.qualificacao,
    funilSnap: c.funil,
    utmSourceSnap: c.utmSource,
    utmMediumSnap: c.utmMedium,
    utmCampaignSnap: c.utmCampaign,
    utmIdSnap: "",
    utmContentSnap: c.utmContent,
    utmTermSnap: c.utmTerm,
    _src: "clint",
  };
}

/** Normaliza um negócio Clint para o formato da aba `vendas`. */
function toVenda(c: ClintRow): Sourced<VendaRow> {
  return {
    nomeComprador: c.nome,
    empresa: "",
    email: c.email,
    valorContrato: c.valor,
    dataEntradaBase: null,
    dataAceite: null,
    dataCriacaoContrato: null,
    dataAssinatura: null,
    cargoComprador: c.cargo,
    origemFunil: "",
    funilCompra: c.funil,
    produto: "Mentoria",
    pixAceite: "",
    formaPagamento: "",
    dataCompra: c.dataVenda,
    dataCadastroSnap: null,
    nomeSnap: c.nome,
    emailSnap: c.email,
    telefoneSnap: "",
    cargoSnap: c.cargo,
    faturamentoSnap: c.faturamento,
    segmentoSnap: c.segmento,
    qualificacaoSnap: c.qualificacao,
    funilSnap: c.funil,
    utmSourceSnap: c.utmSource,
    utmMediumSnap: c.utmMedium,
    utmCampaignSnap: c.utmCampaign,
    utmIdSnap: "",
    utmContentSnap: c.utmContent,
    utmTermSnap: c.utmTerm,
    _src: "clint",
  };
}

const tagLegacy = <T>(rows: T[]): T[] =>
  rows.map((r) => ({ ...r, _src: "legacy" as RowSource }));

/**
 * Funde a aba `clint` nas abas legadas sdr/vendas com marcador de origem.
 * O corte por data é aplicado depois, em `filterByDate`. Retorna um novo
 * RawData; não muta o original. `data.clint` é preservado para métricas
 * que só existem no Clint (ex: Negócios criados).
 *
 * O filtro de tags entra AQUI, antes da fusão, e o `data.clint` devolvido
 * já vai cortado — assim todas as métricas derivadas (negócios criados,
 * reuniões, vendas, funil, roscas, tabela diária) respeitam o corte sem
 * que cada calc precise saber de tag.
 */
export function mergeClint<T extends Partial<RawData>>(
  data: T,
  filters?: Pick<FilterState, "tags" | "tagsMode">
): T {
  const clint = filterClintByTags(data.clint ?? [], filters);
  const withTags = { ...data, ...(data.clint ? { clint } : {}) };
  const cRows = clintRows(withTags);
  const patch: Partial<RawData> = {};
  if (data.sdr) patch.sdr = [...tagLegacy(data.sdr), ...cRows.map(toSdr)];
  if (data.vendas)
    patch.vendas = [...tagLegacy(data.vendas), ...cRows.map(toVenda)];
  return { ...withTags, ...patch };
}

/**
 * Negócios criados (métrica nova, só Clint): contagem de linhas Clint cuja
 * Data de criação do negócio cai no período. Como só existe no Clint, é
 * naturalmente vazia antes de julho (o cutoff em filterByDate garante).
 */
export function countNegociosCriados(
  data: { clint?: ClintRow[] },
  from: Date,
  to: Date
): number {
  const rows = clintRows(data).map((c) => ({
    d: c.dataCriacao,
    _src: "clint" as RowSource,
  }));
  return filterByDate(rows, (r) => r.d, from, to).length;
}

export { MIGRACAO_CLINT_CUTOFF_TS };
