import type {
  AdsLinkRow,
  FbTodosRow,
  LeadRow,
  MetaRow,
  SdrRow,
  VendaRow,
} from "@/lib/sheets/schemas";

/**
 * Tipos compartilhados entre as funções de cálculo das 7 páginas.
 * Schemas reais em src/lib/sheets/schemas.ts.
 * Fonte: PRD §5.2 + wireframe.
 */

export type Funil = "sala" | "aplica" | "sessao" | "isca" | "reality" | "todos";

export type FilterState = {
  from: Date;
  to: Date;
  /** Lista de funis (ex: ["sessao", "sala"]). Vazio/undefined = todos. */
  funis?: Funil[];
  /** Produto (Closer/Metas). Default operacional = "Mentoria". */
  produto?: string;
  /** Forma de pagamento (Closer). */
  pagamento?: string;
  /** Temperatura (Tráfego/Anúncios). */
  temperatura?: "todas" | "frio" | "quente" | "adv";
  /** Toggle ranking — campanha ou adset (Tráfego). */
  rankingBy?: "campanha" | "adset";
  /** Nome do SDR (Comercial SDR). */
  sdr?: string;
  /** Status de reunião (Comercial SDR). */
  status?: string;
  /** Busca client-side ou server (Tráfego/Anúncios). */
  busca?: string;
};

/** Conjunto bruto de dados disponível pras funções de cálculo.
 *  Chaves espelham os nomes das abas pra plug direto de readAllSheets.
 */
export type RawData = {
  fb_todos: FbTodosRow[];
  leads: LeadRow[];
  sdr: SdrRow[];
  vendas: VendaRow[];
  Metas?: MetaRow[];
  ads_links?: AdsLinkRow[];
};

export type RawSubset<K extends keyof RawData> = Pick<RawData, K>;

// Re-exporta tipos das abas pra consumo conveniente
export type {
  AdsLinkRow,
  FbTodosRow,
  LeadRow,
  SdrRow,
  VendaRow,
  MetaRow,
};

// ---------------------------------------------------------------------------
// Estruturas auxiliares
// ---------------------------------------------------------------------------

export type FunnelStep = {
  etapa: string;
  valor: number;
  /** Conversão da etapa anterior (0..1). Primeira etapa = 1. */
  conversaoEtapa: number;
};

export type Delta = {
  value: number;
  direction: "up" | "down";
} | null;

// ---------------------------------------------------------------------------
// Página 1 — Visão Geral
// ---------------------------------------------------------------------------

export type VisaoGeralKPIs = {
  investimento: number;
  leads: number;
  leadsDelta: Delta;
  cpl: number;
  mql: number;
  cmql: number;
  txLeadParaMql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioes: number; // realizadas
  show: number; // realizadas / agendadas
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  cac: number;
  roas: number;
  /** Vendas / MQL */
  conversaoVendas: number;
  /** Vendas / Reuniões realizadas */
  convReunParaVenda: number;
  /** Soma de valorProposta onde proposta foi enviada (status SDR) */
  pipeline: number;
  propostasEmAberto: number;
};

export type DailyPoint = {
  dia: Date;
  investimento: number;
  leads: number;
  mql: number;
  cmql: number | null;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
  /** % conversão acumulada Vendas/MQL (linha do eixo direito do combo) */
  convMqlVenda: number | null;
};

export type CustoPorEtapaPoint = {
  dia: Date;
  cpl: number | null;
  cmql: number | null;
  cac: number | null;
};

export type DistribuicaoPorFunil = {
  funil: Funil;
  leads: number;
  mql: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
};

export type TabelaDiariaRow = {
  dia: Date;
  investimento: number;
  mql: number;
  custoPorMql: number | null;
  agendamentos: number;
  mqlParaAgend: number | null;
  reunioesAgendadas: number;
  mqlParaReunAg: number | null;
  reunioesRealizadas: number;
  show: number | null;
  vendas: number;
  conversao: number | null;
  faturamento: number;
};

export type TabelaDiariaTotal = Omit<TabelaDiariaRow, "dia"> & {
  etapa: "TOTAL";
};

export type VisaoGeralResult = {
  kpis: VisaoGeralKPIs;
  serieDiaria: DailyPoint[];
  funilConsolidado: FunnelStep[];
  custoPorEtapa: CustoPorEtapaPoint[];
  distribuicaoPorFunil: DistribuicaoPorFunil[];
  tabelaDiaria: TabelaDiariaRow[];
  tabelaDiariaTotal: TabelaDiariaTotal;
};

// ---------------------------------------------------------------------------
// Página 2 — Tráfego Pago
// ---------------------------------------------------------------------------

export type TrafegoKPIs = {
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  cpl: number;
  /** Leads / LP Views */
  txLpLead: number;
  mql: number;
  cmql: number;
  /** MQL / Leads */
  txLeadMql: number;
};

export type TrafegoComboPoint = {
  dia: Date;
  investimento: number;
  cliques: number;
  leads: number;
  mql: number;
  cmql: number | null;
};

export type TrafegoFunilResumo = {
  impressoes: number;
  cliques: number;
  lpViews: number;
  leads: number;
  mql: number;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  cpl: number | null;
  cmql: number | null;
  txLpLead: number | null;
};

export type TrafegoMqlCmqlPorFunil = {
  funil: Funil;
  mql: number;
  cmql: number | null;
  investimento: number;
};

export type TrafegoRankingRow = {
  nome: string;
  agrupamento: "campanha" | "adset";
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
  lpViews: number;
  leads: number;
  cpl: number;
  mql: number;
  cmql: number;
};

export type TrafegoResult = {
  kpis: TrafegoKPIs;
  serieCombo: TrafegoComboPoint[];
  mqlCmqlPorFunil: TrafegoMqlCmqlPorFunil[];
  funilTrafego: FunnelStep[];
  funilTrafegoResumo: TrafegoFunilResumo;
  ranking: TrafegoRankingRow[];
};

// ---------------------------------------------------------------------------
// Página 3 — Comercial SDR
// ---------------------------------------------------------------------------

export type SDRKpis = {
  agendamentos: number;
  reunioesAgendadas: number;
  realizadas: number;
  taxaShow: number;
  propostas: number;
  taxaProposta: number;
  valorPropostas: number;
  // Legado opcional (extras úteis ainda usados por consumidor antigo)
  leadsRecebidos?: number;
  tentativasContato?: number;
  taxaContato?: number;
  taxaAgendamento?: number;
};

export type SDRHeatmapCell = {
  /** 0=Domingo, 6=Sábado */
  diaSemana: number;
  hora: number;
  total: number;
};

export type SDRRow = {
  sdr: string;
  agendou: number;
  realizou: number;
  show: number;
  propostas: number;
  txProposta: number;
  valorProp: number;
  vendas: number;
  close: number;
  // Legado opcional
  leadsAtribuidos?: number;
  tentativas?: number;
  taxaContato?: number;
  taxaAgendamento?: number;
};

export type SDRResult = {
  kpis: SDRKpis;
  /** Agendamentos → Reuniões marcadas → Realizadas → Propostas → Vendas */
  funilSdr: FunnelStep[];
  heatmap: SDRHeatmapCell[];
  porSdr: SDRRow[];
};

// ---------------------------------------------------------------------------
// Página 4 — Comercial Closer
// ---------------------------------------------------------------------------

export type CloserKpis = {
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  /** Receita / Investimento (precisa fb_todos). Null se não disponível. */
  roas: number | null;
  /** Média de dias entre inscrição do lead e dataCompra. Null se não puder calcular. */
  cicloMedio: number | null;
  // Manter pra Performance closers
  reunioes: number;
  propostas: number;
  taxaProposta: number;
  taxaFechamento: number;
};

export type CloserReceitaPorFunil = {
  funil: string; // sala|aplica|sessao|isca|reality|up-sell|outros
  receita: number;
  /** 0..1 */
  pct: number;
};

export type CloserEvolucao12MesesPoint = {
  mes: Date;
  receita: number;
  meta: number | null;
};

export type CloserVendaRow = {
  data: Date;
  comprador: string;
  funil: string;
  produto: string;
  valor: number;
  sdr: string | null;
  pagamento: string;
  ciclo: number | null;
};

export type CloserRow = {
  closer: string;
  agendou: number;
  realizou: number;
  show: number;
  propostas: number;
  txProposta: number;
  valorProp: number;
  vendas: number;
  close: number;
  faturamento: number;
  ticketMedio: number;
};

export type CloserResult = {
  kpis: CloserKpis;
  receitaPorFunil: CloserReceitaPorFunil[];
  evolucao12Meses: CloserEvolucao12MesesPoint[];
  vendasDoPeriodo: CloserVendaRow[];
  porCloser: CloserRow[];
};

// ---------------------------------------------------------------------------
// Página 5 — Metas vs Realizado
// ---------------------------------------------------------------------------

export type MetricaMetaReal = {
  nome: string;
  realValor: number;
  metaMtdValor: number | null;
  pctAtingimento: number | null;
  gap: number | null;
};

export type MetasHero = {
  realFaturamento: number;
  metaFaturamentoMtd: number | null;
  pctAtingimento: number | null;
  gap: number | null;
  projecaoFimDoMes: number;
};

export type MetasCardTaxa = {
  nome: string;
  realValor: number | null;
  metaValor: number | null;
  isInverse?: boolean;
};

export type MetasPacingPoint = {
  date: Date;
  realAcumulado: number;
  metaAcumulada: number | null;
};

export type MetasPacingNecessario = {
  metrica: string;
  valorPorDia: number;
  /** 0..1 */
  pctAvancado: number;
};

export type MetasHistoricoRow = {
  mes: Date;
  investimento: number;
  mql: number;
  cmql: number | null;
  agendamentos: number;
  reunioesRealizadas: number;
  vendas: number;
  conversao: number | null;
  faturamento: number;
  pctMeta: number | null;
};

/** Linha legada — preservada por compat. */
export type MetaComparacao = {
  funil: string;
  metrica: string;
  mes: string;
  metaValor: number;
  realizadoValor: number;
  atingimento: number;
};

export type MetasResult = {
  hero: MetasHero;
  tabelaFunil: MetricaMetaReal[];
  cardsTaxa: MetasCardTaxa[];
  pacingChart: MetasPacingPoint[];
  pacingNecessario: MetasPacingNecessario[];
  historicoMensal: MetasHistoricoRow[];
  rows?: MetaComparacao[];
  resumoPorFunil?: Array<{
    funil: string;
    metaTotal: number;
    realizadoTotal: number;
    atingimento: number;
  }>;
};

// ---------------------------------------------------------------------------
// Página 6 — Anúncios
// ---------------------------------------------------------------------------

export type AnuncioCard = {
  adName: string;
  /** Tráfego */
  investimento: number;
  impressoes: number;
  cliques: number;
  lpViews: number;
  ctr: number;
  cpc: number;
  cpm: number;
  /** Downstream (via utm_content) */
  leads: number;
  cpl: number;
  mql: number;
  cmql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  vendas: number;
  faturamento: number;
  roas: number;
  /** Enriquecimento via aba ads_links */
  thumbnailUrl: string;
  instagramPermalink: string;
};

export type AnunciosResult = {
  topCpl: AnuncioCard[];
  topCmql: AnuncioCard[];
  topVendas: AnuncioCard[];
  /** Até 12 cards visuais com thumbnail */
  galeria: AnuncioCard[];
  /** Todos com atividade no período (sem limite) */
  tabelaAnuncios: AnuncioCard[];
  /** Compat: top 3 por ROAS, mantido pra consumidores antigos */
  topRoas?: AnuncioCard[];
};

// ---------------------------------------------------------------------------
// Página 7 — Origem
// ---------------------------------------------------------------------------

export type OrigemRow = {
  /** Valor da dimensão (ex: "ig" pra utmSource, "Empresário" pra cargo) */
  dimensao: string;
  leadsQualif: number;
  mql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  vendas: number;
  faturamento: number;
  /** Coluna extra usada só em "Por Faixa de Faturamento" */
  qualif?: "Enterprise" | "MQL 1" | "MQL 2";
  /** Legado */
  origem?: string;
  leads?: number;
  reunioes?: number;
  conversaoLeadVenda?: number;
};

export type OrigemResult = {
  porUtmSource: OrigemRow[];
  porUtmMedium: OrigemRow[];
  porUtmCampaign: OrigemRow[];
  porQualificacao: OrigemRow[];
  porCargo: OrigemRow[];
  porFaturamento: OrigemRow[];
  porSegmento: OrigemRow[];
  /** Compat */
  porCategoria?: Array<{
    categoria: string;
    rows: OrigemRow[];
    total: OrigemRow;
  }>;
};
