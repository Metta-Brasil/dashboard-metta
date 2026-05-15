/**
 * Tipos compartilhados entre as funções de cálculo das 7 páginas.
 *
 * Os schemas reais das abas do Sheets ainda não foram congelados — usamos
 * `Row = Record<string, unknown>` como contrato genérico. Cada função `calc*`
 * faz acesso defensivo às colunas que precisa, comentando os campos que ainda
 * não estão confirmados.
 */

/** Linha bruta vinda do Sheets, normalizada como objeto chave -> valor. */
export type Row = Record<string, unknown>;

/** Estado global de filtros, derivado dos search params da URL. */
export type FilterState = {
  from: Date;
  to: Date;
  /** Lista de funis (ex: ["sessao", "sala"]). Vazio/undefined = todos. */
  funis?: string[];
  /** Produto opcional (futuro — não usado em todas as páginas). */
  produto?: string;
};

/** Dados crus disponíveis nas funções de cálculo. */
export type RawData = {
  fbTodos: Row[];
  leads: Row[];
  sdr: Row[];
  vendas: Row[];
};

/** Subset das abas usado por uma função — torna explícito o acoplamento. */
export type RawSubset<K extends keyof RawData> = Pick<RawData, K>;

// ---------------------------------------------------------------------------
// Estruturas auxiliares
// ---------------------------------------------------------------------------

export type FunnelStep = {
  etapa: string;
  valor: number;
  /** Conversão da etapa anterior pra essa (0..1). Primeira etapa = 1. */
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
  /** Custo por MQL */
  cmql: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
  /** Custo de aquisição de cliente */
  cac: number;
  /** Return on ad spend */
  roas: number;
  /** Conversão MQL -> Venda (0..1) */
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

export type MetaRow = {
  funil: string;
  metrica: string;
  mes: string; // "2026-05"
  metaValor: number;
  realizadoValor: number;
  atingimento: number; // 0..1
};

export type MetasResult = {
  rows: MetaRow[];
  /** Resumo agregado por funil (todas as métricas somadas/médias quando aplicável). */
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
  ctr: number; // 0..1
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
  /** utm_content / nome do anúncio */
  utmContent: string;
  /** Nome amigável se houver, senão o utm_content */
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
  /** Top 3 anúncios por ROAS (com mínimo de investimento). */
  topRoas: AnuncioCard[];
  /** Galeria completa, ordenada por investimento decrescente. */
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
  taxaContato: number; // 0..1
  taxaAgendamento: number; // 0..1
  taxaShow: number; // 0..1
};

export type SDRHeatmapCell = {
  /** 0 = domingo, 6 = sábado */
  diaSemana: number;
  /** 0..23 */
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
  taxaProposta: number; // 0..1
  taxaFechamento: number; // 0..1
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
  conversaoLeadVenda: number; // 0..1
};

export type OrigemResult = {
  /** 7 tabelas separadas, uma por categoria de origem (ex: facebook, instagram, google, etc). */
  porCategoria: Array<{
    categoria: string;
    rows: OrigemRow[];
    total: OrigemRow;
  }>;
};
