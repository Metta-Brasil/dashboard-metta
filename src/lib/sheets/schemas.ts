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
  instagramPermalink: zString,
  imageUrl: zString,
});
export type AdsLinkRow = z.infer<typeof AdsLinkRowSchema>;

export const ADS_LINKS_COLUMN_MAP = {
  adName: 0,
  instagramPermalink: 1,
  imageUrl: 2,
} as const;
