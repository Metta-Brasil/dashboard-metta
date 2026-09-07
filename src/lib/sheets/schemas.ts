import { z } from "zod";

/**
 * Schemas Zod das 5 abas-fonte da planilha
 * "BASE DE DADOS - PALIATIVO - FUNIS PAGOS - JANEIRO 2026".
 *
 * Fonte: PRD §4.2 — mapeamento exato das colunas.
 */

// ----- Helpers de coerção -----------------------------------------------------

/** Converte "6,38" | "R$ 11.200,00" | 6.38 | "" | null → number. */
const zCurrency = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    const cleaned = v.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  });

/** Converte inteiro string ou number → number. Vazio → 0. */
const zInt = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === "") return 0;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
  });

/** Converte "01/05/2026" | serial Sheets | ISO → Date. Vazio/inválido → null. */
const zDate = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") {
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const str = String(v).trim();
    const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      const [, d, m, y] = br;
      return new Date(
        `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T03:00:00.000Z`
      );
    }
    const iso = new Date(str);
    return Number.isNaN(iso.getTime()) ? null : iso;
  });

const zString = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v == null ? "" : String(v).trim()));

const zEmail = zString.transform((s) => s.toLowerCase());

/**
 * URL vinda da planilha → só sobrevive http(s). A planilha é compartilhada
 * e esses campos viram `href`/`src` direto na UI: `javascript:...` numa
 * célula seria XSS armazenado (o React só avisa no console, não bloqueia).
 * Valor inválido vira "" — que os componentes já tratam como "sem link" /
 * "sem thumbnail". Não lança: uma célula ruim não pode derrubar a aba toda.
 */
const zUrl = zString.transform((s) => {
  if (s === "") return "";
  try {
    const { protocol } = new URL(s);
    return protocol === "http:" || protocol === "https:" ? s : "";
  } catch {
    return "";
  }
});

// ----- Schemas das abas -------------------------------------------------------

export const FbTodosRowSchema = z.object({
  accountName: zString,
  day: zDate,
  campaignName: zString,
  adSetName: zString,
  adName: zString,
  alcance: zInt,
  impressions: zInt,
  linkClicks: zInt,
  landingPageViews: zInt,
  leadsMeta: zInt,
  visitasPerfil: zInt,
  seguidores: zInt,
  video3s: zInt,
  video25: zInt,
  video95: zInt,
  checkouts: zInt,
  compras: zInt,
  amountSpent: zCurrency,
});
export type FbTodosRow = z.infer<typeof FbTodosRowSchema>;

export const FB_TODOS_COLUMN_MAP = {
  accountName: 0,
  day: 1,
  campaignName: 2,
  adSetName: 3,
  adName: 4,
  alcance: 5,
  impressions: 6,
  linkClicks: 7,
  landingPageViews: 8,
  leadsMeta: 9,
  visitasPerfil: 10,
  seguidores: 11,
  video3s: 12,
  video25: 13,
  video95: 14,
  checkouts: 15,
  compras: 16,
  amountSpent: 17,
} as const;

export const LeadRowSchema = z.object({
  dataInscricaoOriginal: zDate,
  nome: zString,
  email: zEmail,
  telefone: zString,
  cargo: zString,
  faturamento: zString,
  segmento: zString,
  qualificacao: zString,
  funil: zString,
  utmSource: zString,
  utmMedium: zString,
  utmCampaign: zString,
  utmId: zString,
  utmContent: zString,
  utmTerm: zString,
  dataInscricao: zDate,
});
export type LeadRow = z.infer<typeof LeadRowSchema>;

export const LEADS_COLUMN_MAP = {
  dataInscricaoOriginal: 0,
  nome: 1,
  email: 2,
  telefone: 3,
  cargo: 4,
  faturamento: 5,
  segmento: 6,
  qualificacao: 7,
  funil: 8,
  utmSource: 9,
  utmMedium: 10,
  utmCampaign: 11,
  utmId: 12,
  utmContent: 13,
  utmTerm: 14,
  dataInscricao: 15,
} as const;

/**
 * Aba `clint` — negócios vindos do CRM Clint (a partir de julho/2026).
 * A aba tem 39 colunas (A..AM); mapeamos só o que o dashboard consome.
 * `fonte` distingue linhas nativas do Clint ("Clint") do dump histórico
 * do HubSpot ("HubsSpot") — só as de fonte Clint entram na migração.
 * Datas-guia por métrica: dataCriacao (B) = negócio criado,
 * dataReuniao (C) = reunião, dataVenda (E) = venda.
 *
 * `pipeline` (AM) é o quadro do CRM ("Operação Resgate · Reativação de
 * Base"), NÃO a etapa: `etapa` diz em que coluna do quadro o card está e os
 * nomes de etapa se repetem entre quadros. Só o par pipelineId/pipeline
 * isola uma pipeline. Vem em branco nas linhas escritas antes de 07/09/2026
 * e no dump histórico do HubSpot.
 */
export const ClintRowSchema = z.object({
  fonte: zString,
  dataCriacao: zDate,
  dataReuniao: zDate,
  hora: zString,
  dataVenda: zDate,
  nome: zString,
  email: zEmail,
  cargo: zString,
  faturamento: zString,
  qualificacao: zString,
  segmento: zString,
  subsegmento: zString,
  funil: zString,
  utmSource: zString,
  utmMedium: zString,
  utmCampaign: zString,
  utmContent: zString,
  utmTerm: zString,
  status: zString,
  etapa: zString,
  sdr: zString,
  closer: zString,
  eSal: zString,
  eSql: zString,
  tag: zString,
  valor: zCurrency,
  telefone: zString,
  instagram: zString,
  dealId: zString,
  dono: zString,
  dataEntradaEtapa: zDate,
  pipelineId: zString,
  pipeline: zString,
});
export type ClintRow = z.infer<typeof ClintRowSchema>;

export const CLINT_COLUMN_MAP = {
  fonte: 0,
  dataCriacao: 1,
  dataReuniao: 2,
  hora: 3,
  dataVenda: 4,
  nome: 5,
  email: 6,
  cargo: 9,
  faturamento: 10,
  qualificacao: 11,
  segmento: 12,
  subsegmento: 13,
  funil: 14,
  utmSource: 15,
  utmMedium: 16,
  utmCampaign: 17,
  utmContent: 18,
  utmTerm: 19,
  status: 26,
  etapa: 27,
  sdr: 29,
  closer: 30,
  eSal: 31,
  eSql: 32,
  tag: 35,
  valor: 36,
  telefone: 7,
  instagram: 8,
  dealId: 24,
  dono: 25,
  dataEntradaEtapa: 28,
  pipelineId: 37,
  pipeline: 38,
} as const;

export const SdrRowSchema = z.object({
  dataAgendamento: zDate,
  dataReuniao: zDate,
  quemAgendou: zString,
  responsavel: zString,
  qualificacaoSdr: zString,
  lead: zString,
  cargo: zString,
  email: zEmail,
  origem: zString,
  funil: zString,
  status: zString,
  envioProposta: zString,
  valorProposta: zCurrency,
  horarioReuniao: zString,
  dataInscricaoSnap: zDate,
  nomeSnap: zString,
  telefoneSnap: zString,
  cargoSnap: zString,
  faturamentoSnap: zString,
  segmentoSnap: zString,
  qualificacaoSnap: zString,
  funilSnap: zString,
  utmSourceSnap: zString,
  utmMediumSnap: zString,
  utmCampaignSnap: zString,
  utmIdSnap: zString,
  utmContentSnap: zString,
  utmTermSnap: zString,
});
export type SdrRow = z.infer<typeof SdrRowSchema>;

export const SDR_COLUMN_MAP = {
  dataAgendamento: 0,
  dataReuniao: 1,
  quemAgendou: 2,
  responsavel: 3,
  qualificacaoSdr: 4,
  lead: 5,
  cargo: 6,
  email: 7,
  origem: 8,
  funil: 9,
  status: 10,
  envioProposta: 11,
  valorProposta: 12,
  // Coluna N "Horário da reunião" inserida na planilha → todo o bloco
  // snapshot (data de inscrição em diante) é +1 vs a versão anterior.
  horarioReuniao: 13,
  dataInscricaoSnap: 14,
  nomeSnap: 15,
  telefoneSnap: 16,
  cargoSnap: 17,
  faturamentoSnap: 18,
  segmentoSnap: 19,
  qualificacaoSnap: 20,
  funilSnap: 21,
  utmSourceSnap: 22,
  utmMediumSnap: 23,
  utmCampaignSnap: 24,
  utmIdSnap: 25,
  utmContentSnap: 26,
  utmTermSnap: 27,
} as const;

export const VendaRowSchema = z.object({
  nomeComprador: zString,
  empresa: zString,
  email: zEmail,
  valorContrato: zCurrency,
  dataEntradaBase: zDate,
  dataAceite: zDate,
  dataCriacaoContrato: zDate,
  dataAssinatura: zDate,
  cargoComprador: zString,
  origemFunil: zString,
  funilCompra: zString,
  produto: zString,
  pixAceite: zString,
  formaPagamento: zString,
  dataCompra: zDate,
  dataCadastroSnap: zDate,
  nomeSnap: zString,
  emailSnap: zString,
  telefoneSnap: zString,
  cargoSnap: zString,
  faturamentoSnap: zString,
  segmentoSnap: zString,
  qualificacaoSnap: zString,
  funilSnap: zString,
  utmSourceSnap: zString,
  utmMediumSnap: zString,
  utmCampaignSnap: zString,
  utmIdSnap: zString,
  utmContentSnap: zString,
  utmTermSnap: zString,
});
export type VendaRow = z.infer<typeof VendaRowSchema>;

export const VENDAS_COLUMN_MAP = {
  nomeComprador: 0,
  empresa: 1,
  email: 2,
  valorContrato: 3,
  dataEntradaBase: 4,
  dataAceite: 5,
  dataCriacaoContrato: 6,
  dataAssinatura: 7,
  cargoComprador: 8,
  origemFunil: 9,
  funilCompra: 10,
  produto: 11,
  pixAceite: 12,
  formaPagamento: 13,
  dataCompra: 14,
  // A aba vendas tem uma coluna "email" no snapshot (idx 17) que NÃO
  // está no cabeçalho — por isso tudo daqui pra frente é +1 vs header.
  dataCadastroSnap: 15,
  nomeSnap: 16,
  emailSnap: 17,
  telefoneSnap: 18,
  cargoSnap: 19,
  faturamentoSnap: 20,
  segmentoSnap: 21,
  qualificacaoSnap: 22,
  funilSnap: 23,
  utmSourceSnap: 24,
  utmMediumSnap: 25,
  utmCampaignSnap: 26,
  utmIdSnap: 27,
  utmContentSnap: 28,
  utmTermSnap: 29,
} as const;

export const MetaRowSchema = z.object({
  mes: zDate,
  funil: zString,
  metrica: zString,
  valor: zCurrency,
});
export type MetaRow = z.infer<typeof MetaRowSchema>;

export const METAS_COLUMN_MAP = {
  mes: 0,
  funil: 1,
  metrica: 2,
  valor: 3,
} as const;

// ----- ads links (alimentada por workflow externo) ---------------------------

export const AdsLinkRowSchema = z.object({
  adName: zString,
  instagramPermalink: zUrl,
  imageUrl: zUrl,
});
export type AdsLinkRow = z.infer<typeof AdsLinkRowSchema>;

export const ADS_LINKS_COLUMN_MAP = {
  adName: 0,
  instagramPermalink: 1,
  imageUrl: 2,
} as const;

// ----- Análise Tráfego (relatório per-anúncio da planilha) -------------------
// Fonte de verdade do relatório que o usuário compara (aba "Análise Tráfego").
// Spend/impr/cliques vêm da aba `fb`; leads/MQL das abas ap/sala/se/
// 'aplicação hubspot', cruzadas por NOME DO ANÚNCIO.

/** Aba `fb`: Day | Campaign | AdSet | Ad | Impr | Clicks | LPViews | Leads | Spent */
export const FbAtRowSchema = z.object({
  day: zDate,
  campaignName: zString,
  adName: zString,
  impressions: zInt,
  linkClicks: zInt,
  landingPageViews: zInt,
  amountSpent: zCurrency,
});
export type FbAtRow = z.infer<typeof FbAtRowSchema>;
export const FB_AT_COLUMN_MAP = {
  day: 0,
  campaignName: 1,
  adName: 3,
  impressions: 4,
  linkClicks: 5,
  landingPageViews: 6,
  amountSpent: 8,
} as const;

/** Linha de lead normalizada (abas ap/sala/se/'aplicação hubspot'). */
export const AtLeadRowSchema = z.object({
  data: zDate,
  campaignName: zString,
  adName: zString,
  qualificacao: zString,
});
export type AtLeadRow = z.infer<typeof AtLeadRowSchema>;

// ap/sala: L=camp(11) N=ad(13) P=data(15) H=qualif(7)
export const AT_AP_COLUMN_MAP = {
  data: 15,
  campaignName: 11,
  adName: 13,
  qualificacao: 7,
} as const;
export const AT_SALA_COLUMN_MAP = AT_AP_COLUMN_MAP;
// se: L=camp(11) N=ad(13) P=data(15) Q=qualif(16)
export const AT_SE_COLUMN_MAP = {
  data: 15,
  campaignName: 11,
  adName: 13,
  qualificacao: 16,
} as const;
// 'aplicação hubspot': G=data(6) K=camp(10) L=ad(11) N=qualif(13)
export const AT_APH_COLUMN_MAP = {
  data: 6,
  campaignName: 10,
  adName: 11,
  qualificacao: 13,
} as const;

// ----- Instagram (perfil + posts) --------------------------------------------

/** Converte decimal string ou number → number. Vazio → 0. */
const zFloat = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === "") return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  });

/**
 * Snapshot diário de perfil Instagram.
 * Colunas A-E: Data, Seguidores, Seguindo, Posts, Alcance 28d
 * Colunas F-I são métricas DIÁRIAS da conta (não 28d, apesar dos nomes de campo
 * legados contasEngajadas28d/interacoesTotais28d):
 *   F: Alcance Dia · G: Contas Engajadas · H: Interações · I: Views
 * Linhas históricas (só A-E, ou A-H sem Views) parsearão as colunas ausentes
 * como 0 — comportamento correto.
 */
export const IgProfileRowSchema = z.object({
  data: zDate,
  seguidores: zInt,
  seguindo: zInt,
  posts: zInt,
  alcance28d: zInt,
  alcanceDia: zInt,
  contasEngajadas28d: zInt,
  interacoesTotais28d: zInt,
  viewsDia: zInt,
});
export type IgProfileRow = z.infer<typeof IgProfileRowSchema>;

export const IG_METTA_PERFIL_COLUMN_MAP = {
  data: 0,
  seguidores: 1,
  seguindo: 2,
  posts: 3,
  alcance28d: 4,
  alcanceDia: 5,
  contasEngajadas28d: 6,
  interacoesTotais28d: 7,
  viewsDia: 8,
} as const;

export const IG_TIAGO_PERFIL_COLUMN_MAP = IG_METTA_PERFIL_COLUMN_MAP;

/**
 * Post Instagram (overwrite horário).
 * Colunas A-O: Post ID, Data, Tipo, Legenda, Permalink, Thumbnail URL,
 * Curtidas, Comentários, Views, Alcance, Salvamentos, Compartilhamentos,
 * Repostagens, Skip Rate %, Taxa Engajamento %
 * Coluna P (2026-06): Hora (HH:mm BRT)
 * Colunas Q-R (2026-06): Visitas Perfil, Seguidores (follows) — só FEED;
 *   Reels não suportam essas métricas por mídia → 0. Linhas antigas (A:P)
 *   parseiam Q/R ausentes como 0.
 */
export const IgPostsRowSchema = z.object({
  postId: zString,
  data: zDate,
  tipo: zString,
  legenda: zString,
  permalink: zUrl,
  thumbnailUrl: zUrl,
  curtidas: zInt,
  comentarios: zInt,
  views: zInt,
  alcance: zInt,
  salvamentos: zInt,
  compartilhamentos: zInt,
  repostagens: zInt,
  skipRate: zFloat,
  taxaEngajamento: zFloat,
  hora: zString,
  visitasPerfil: zInt,
  seguidores: zInt,
});
export type IgPostsRow = z.infer<typeof IgPostsRowSchema>;

export const IG_METTA_POSTS_COLUMN_MAP = {
  postId: 0,
  data: 1,
  tipo: 2,
  legenda: 3,
  permalink: 4,
  thumbnailUrl: 5,
  curtidas: 6,
  comentarios: 7,
  views: 8,
  alcance: 9,
  salvamentos: 10,
  compartilhamentos: 11,
  repostagens: 12,
  skipRate: 13,
  taxaEngajamento: 14,
  hora: 15,
  visitasPerfil: 16,
  seguidores: 17,
} as const;

export const IG_TIAGO_POSTS_COLUMN_MAP = IG_METTA_POSTS_COLUMN_MAP;

/**
 * Demografia de seguidores (aba ig_*_demograficos, overwrite diário).
 * A: Dimensao (idade_genero | cidade | pais)
 * B: Chave — para idade_genero é "<faixa>|<genero>" (ex. "25-34|F")
 * C: Seguidores (contagem)
 * D: Coletado Em (data)
 */
export const IgDemograficosRowSchema = z.object({
  dimensao: zString,
  chave: zString,
  seguidores: zInt,
  coletadoEm: zDate,
});
export type IgDemograficosRow = z.infer<typeof IgDemograficosRowSchema>;

export const IG_METTA_DEMOGRAFICOS_COLUMN_MAP = {
  dimensao: 0,
  chave: 1,
  seguidores: 2,
  coletadoEm: 3,
} as const;

export const IG_TIAGO_DEMOGRAFICOS_COLUMN_MAP = IG_METTA_DEMOGRAFICOS_COLUMN_MAP;

/**
 * Story Instagram (aba ig_*_stories, APPEND-ONLY por Story ID).
 * A API só devolve stories ativos (~24h); o sync acumula histórico via upsert.
 * A: Story ID · B: Data · C: Hora · D: Tipo · E: Permalink · F: Thumbnail ·
 * G: Views · H: Alcance · I: Navegação · J: Respostas · K: Compartilhamentos ·
 * L: Interações · M: Seguidores (follows) · N: Visitas Perfil · O: Coletado Em
 */
export const IgStoriesRowSchema = z.object({
  storyId: zString,
  data: zDate,
  hora: zString,
  tipo: zString,
  permalink: zUrl,
  thumbnailUrl: zUrl,
  views: zInt,
  alcance: zInt,
  navegacao: zInt,
  respostas: zInt,
  compartilhamentos: zInt,
  interacoes: zInt,
  seguidores: zInt,
  visitasPerfil: zInt,
  coletadoEm: zDate,
});
export type IgStoriesRow = z.infer<typeof IgStoriesRowSchema>;

export const IG_METTA_STORIES_COLUMN_MAP = {
  storyId: 0,
  data: 1,
  hora: 2,
  tipo: 3,
  permalink: 4,
  thumbnailUrl: 5,
  views: 6,
  alcance: 7,
  navegacao: 8,
  respostas: 9,
  compartilhamentos: 10,
  interacoes: 11,
  seguidores: 12,
  visitasPerfil: 13,
  coletadoEm: 14,
} as const;

export const IG_TIAGO_STORIES_COLUMN_MAP = IG_METTA_STORIES_COLUMN_MAP;
