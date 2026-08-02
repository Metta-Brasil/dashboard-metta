import type { ClintRow, SdrRow, VendaRow } from "@/lib/sheets/schemas";
import type { RawData } from "@/lib/calc/types";
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
 */
export function mergeClint<T extends Partial<RawData>>(data: T): T {
  const cRows = clintRows(data);
  const patch: Partial<RawData> = {};
  if (data.sdr) patch.sdr = [...tagLegacy(data.sdr), ...cRows.map(toSdr)];
  if (data.vendas)
    patch.vendas = [...tagLegacy(data.vendas), ...cRows.map(toVenda)];
  return { ...data, ...patch };
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
