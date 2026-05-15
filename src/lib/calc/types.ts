import type {
  FbTodosRow,
  LeadRow,
  MetaRow,
  SdrRow,
  VendaRow,
} from "@/lib/sheets/schemas";

/**
 * Tipos compartilhados entre as funções de cálculo das 7 páginas.
 * Schemas reais em src/lib/sheets/schemas.ts.
 */

export type FilterState = {
  from: Date;
  to: Date;
  /** Lista de funis (ex: ["sessao", "sala"]). Vazio/undefined = todos. */
  funis?: Funil[];
  /** Produto (futuro — Metas vs Realizado usa). */
  produto?: string;
};

export type Funil = "sala" | "aplica" | "sessao" | "isca" | "reality" | "todos";

/** Conjunto bruto de dados disponível pras funções de cálculo.
 *  Chaves espelham os nomes das abas (snake_case) pra plug direto de readAllSheets.
 */
export type RawData = {
  fb_todos: FbTodosRow[];
  leads: LeadRow[];
  sdr: SdrRow[];
  vendas: VendaRow[];
  Metas?: MetaRow[];
};

export type RawSubset<K extends keyof RawData> = Pick<RawData, K>;

// Re-exporta tipos das abas pra consumo conveniente
export type { FbTodosRow, LeadRow, SdrRow, VendaRow, MetaRow };

// ---------------------------------------------------------------------------
// Estruturas auxiliares
// ---------------------------------------------------------------------------

export type FunnelStep = {
  etapa: string;
  valor: number;
  /** Conversão da etapa anterior (0..1). Primeira etapa = 1. */
  conversaoEtapa: number;
};

export type DailyPoint = {
  dia: Date;
  investimento: number;
  mql: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
};

// ---------------------------------------------------------------------------
// Página 1 — Visão Geral
// ---------------------------------------------------------------------------

export type VisaoGeralKPIs = {
  investimento: number;
  mql: number;
  cmql: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
  cac: number;
  roas: number;
  conversaoVendas: number;
};

export type VisaoGeralResult = {
  kpis: VisaoGeralKPIs;
  serieDiaria: DailyPoint[];
  funilConsolidado: FunnelStep[];
};

// ---------------------------------------------------------------------------
// Página 2 — Metas vs Realizado
// ---------------------------------------------------------------------------

export type MetaComparacao = {
  funil: string;
  metrica: string;
  mes: string;
  metaValor: number;
  realizadoValor: number;
  atingimento: number;
};

export type MetasResult = {
  rows: MetaComparacao[];
  resumoPorFunil: Array<{
    funil: string;
    metaTotal: number;
    realizadoTotal: number;
    atingimento: number;
  }>;
};

// ---------------------------------------------------------------------------
// Página 3 — Tráfego Pago
// ---------------------------------------------------------------------------

export type TrafegoKPIs = {
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
  mql: number;
  cmql: number;
};

export type TrafegoComboPoint = {
  dia: Date;
  investimento: number;
  cliques: number;
  mql: number;
};

export type TrafegoRankingRow = {
  campanha: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  mql: number;
  cmql: number;
};

export type TrafegoResult = {
  kpis: TrafegoKPIs;
  serieCombo: TrafegoComboPoint[];
  ranking: TrafegoRankingRow[];
  funilTrafego: FunnelStep[];
};

// ---------------------------------------------------------------------------
// Página 4 — Anúncios
// ---------------------------------------------------------------------------

export type AnuncioCard = {
  utmContent: string;
  nome: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  mql: number;
  vendas: number;
  faturamento: number;
  roas: number;
  cpm: number;
  cmql: number;
};

export type AnunciosResult = {
  topRoas: AnuncioCard[];
  galeria: AnuncioCard[];
};

// ---------------------------------------------------------------------------
// Página 5 — Comercial SDR
// ---------------------------------------------------------------------------

export type SDRKpis = {
  leadsRecebidos: number;
  tentativasContato: number;
  agendamentos: number;
  reunioes: number;
  taxaContato: number;
  taxaAgendamento: number;
  taxaShow: number;
};

export type SDRHeatmapCell = {
  diaSemana: number;
  hora: number;
  total: number;
};

export type SDRRow = {
  sdr: string;
  leadsAtribuidos: number;
  tentativas: number;
  agendamentos: number;
  reunioes: number;
  taxaContato: number;
  taxaAgendamento: number;
  taxaShow: number;
};

export type SDRResult = {
  kpis: SDRKpis;
  heatmap: SDRHeatmapCell[];
  porSdr: SDRRow[];
};

// ---------------------------------------------------------------------------
// Página 6 — Comercial Closer
// ---------------------------------------------------------------------------

export type CloserKpis = {
  reunioes: number;
  propostas: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  taxaProposta: number;
  taxaFechamento: number;
};

export type CloserRow = {
  closer: string;
  reunioes: number;
  propostas: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  taxaProposta: number;
  taxaFechamento: number;
};

export type CloserResult = {
  kpis: CloserKpis;
  porCloser: CloserRow[];
};

// ---------------------------------------------------------------------------
// Página 7 — Origem
// ---------------------------------------------------------------------------

export type OrigemRow = {
  origem: string;
  leads: number;
  mql: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
  conversaoLeadVenda: number;
};

export type OrigemResult = {
  porCategoria: Array<{
    categoria: string;
    rows: OrigemRow[];
    total: OrigemRow;
  }>;
};
