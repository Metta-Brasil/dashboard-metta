import type {
  AdsLinkRow,
  AtLeadRow,
  ClintRow,
  FbAtRow,
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
  /** Nomes de SDR selecionados (Comercial SDR). Vazio/undefined = todos. */
  sdr?: string[];
  /** Status de reunião selecionados (Comercial SDR). Vazio/undefined = todos. */
  status?: string[];
  /** Modo de agrupamento da tabela "Performance por data" (Comercial SDR). */
  sdrDate?: "agendamento" | "reuniao";
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
  /** Negócios do CRM Clint (julho/2026 em diante). Fonte da migração. */
  clint?: ClintRow[];
  Metas?: MetaRow[];
  ads_links?: AdsLinkRow[];
  // Análise Tráfego (relatório per-anúncio)
  fb_at?: FbAtRow[];
  at_ap?: AtLeadRow[];
  at_sala?: AtLeadRow[];
  at_se?: AtLeadRow[];
  at_aph?: AtLeadRow[];
};

export type RawSubset<K extends keyof RawData> = Pick<RawData, K>;

// Re-exporta tipos das abas pra consumo conveniente
export type {
  AdsLinkRow,
  AtLeadRow,
  ClintRow,
  FbAtRow,
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
  /** Negócios criados no CRM Clint (jul/2026+). Substitui a antiga "Leads". */
  negociosCriados: number;
  negociosCriadosDelta: Delta;
  /** Investimento ÷ Negócios criados (antigo CPL). */
  custoPorNegocio: number;
  mql: number;
  cmql: number;
  /** MQL ÷ Negócios criados (antiga taxa Lead→MQL). */
  txNegocioParaMql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioes: number; // realizadas
  show: number; // realizadas / agendadas
  noShow: number; // agendadas - realizadas
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
  negociosCriados: number;
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
  custoPorNegocio: number | null;
  cmql: number | null;
  cac: number | null;
};

export type DistribuicaoPorFunil = {
  funil: Funil;
  negociosCriados: number;
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
  negociosCriados: number;
  custoPorNegocio: number | null;
  /** Taxa MQL → Negócio criado (negócios ÷ MQL). */
  mqlParaNegocio: number | null;
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

/** Par nome→valor para gráficos de ranking/distribuição. */
export type NomeValor = { name: string; value: number };

export type VisaoGeralResult = {
  kpis: VisaoGeralKPIs;
  serieDiaria: DailyPoint[];
  funilConsolidado: FunnelStep[];
  custoPorEtapa: CustoPorEtapaPoint[];
  distribuicaoPorFunil: DistribuicaoPorFunil[];
  /** Negócios criados por segmento de mercado (rosca). */
  distribuicaoPorSegmento: NomeValor[];
  /** Negócios criados por subsegmento (barras horizontais). */
  distribuicaoPorSubsegmento: NomeValor[];
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
  /** Negócios criados no Clint (jul/2026+). */
  negociosCriados: number;
  /** Investimento ÷ Negócios criados. */
  custoPorNegocio: number;
};

export type TrafegoComboPoint = {
  dia: Date;
  investimento: number;
  cliques: number;
  leads: number;
  mql: number;
  cmql: number | null;
  negociosCriados: number;
  custoPorNegocio: number | null;
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

export type TrafegoMqlPorTemperatura = {
  temperatura: "Advantage" | "Quente" | "Frio";
  mql: number;
};

/** Taxas do funil de tráfego (valor em fração 0..1). */
export type TrafegoConversaoTaxa = {
  metrica: string;
  valor: number;
};

/** Custo por etapa do funil de tráfego (valor em R$). */
export type TrafegoCustoEtapa = {
  metrica: string;
  valor: number;
};

/** Conversões diárias (taxas em fração 0..1) — série de linhas. */
export type TrafegoConversaoDiaPoint = {
  dia: Date;
  ctr: number;
  conexaoLp: number;
  conversaoLp: number;
  conversaoCliques: number;
};

/** Custos diários (R$) — série de linhas. */
export type TrafegoCustoDiaPoint = {
  dia: Date;
  cpc: number;
  cpm: number;
  cpl: number;
  cmql: number | null;
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
  negociosCriados: number;
  custoPorNegocio: number;
};

export type TrafegoResult = {
  kpis: TrafegoKPIs;
  serieCombo: TrafegoComboPoint[];
  mqlCmqlPorFunil: TrafegoMqlCmqlPorFunil[];
  mqlPorTemperatura: TrafegoMqlPorTemperatura[];
  funilTrafego: FunnelStep[];
  funilTrafegoResumo: TrafegoFunilResumo;
  conversoesTrafego: TrafegoConversaoTaxa[];
  custosTrafego: TrafegoCustoEtapa[];
  serieConversoesDia: TrafegoConversaoDiaPoint[];
  serieCustosDia: TrafegoCustoDiaPoint[];
  ranking: TrafegoRankingRow[];
};

// ---------------------------------------------------------------------------
// Página — TP Distribuição de conteúdo (2-em-1: Vídeo | Seguidores)
// ---------------------------------------------------------------------------

export type TpDistKpi = {
  label: string;
  value: number;
  format: "brl" | "int" | "percent";
};

/** Superset com todos os campos numéricos usados pelas duas tabelas. */
export type TpDistTableRow = {
  adName: string;
  investimento: number;
  cliques: number;
  cpc: number;
  ctr: number;
  cpm: number;
  visitasPerfil: number;
  custoVisita: number;
  seguidores: number;
  custoSeguidor: number;
  visitasSeguidores: number;
  hookRate: number;
  video3s: number;
  video25: number;
  cpv25: number;
  video95: number;
  cpv95: number;
};

export type TpDistribuicaoResult = {
  modo: "video" | "seguidores";
  kpis: TpDistKpi[];
  serie: { dia: Date; [k: string]: Date | number | null }[];
  funil: FunnelStep[];
  tabela: TpDistTableRow[];
};

// ---------------------------------------------------------------------------
// Página 3 — Comercial SDR
// ---------------------------------------------------------------------------

export type SDRKpis = {
  /** Negócios criados no Clint (jul/2026+). */
  negociosCriados: number;
  /** É SAL (Clint) — negócios marcados como SAL no período. */
  sal: number;
  /** É SQL (Clint) — negócios marcados como SQL no período. */
  sql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  realizadas: number;
  taxaShow: number;
  propostas: number;
  taxaProposta: number;
  valorPropostas: number;
  vendas: number;
  faturamento: number;
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
  /** Negócios criados no Clint atribuídos a este SDR (jul+). */
  negociosCriados: number;
  /** Agendamentos ÷ Negócios criados. */
  taxaAgendamento: number;
  agendou: number;
  realizou: number;
  show: number;
  /** No-show = 1 − show (agendadas que não realizaram). */
  noShow: number;
  propostas: number;
  txProposta: number;
  valorProp: number;
  vendas: number;
  close: number;
  // Legado opcional
  leadsAtribuidos?: number;
  tentativas?: number;
  taxaContato?: number;
};

/** Ponto diário: reuniões agendadas e realizadas por data da reunião. */
export type SDRReuniaoDiaPoint = {
  dia: Date;
  agendadas: number;
  realizadas: number;
};

export type SDRResult = {
  kpis: SDRKpis;
  /** Agendamentos → Reuniões marcadas → Realizadas → Propostas → Vendas */
  funilSdr: FunnelStep[];
  porSdr: SDRRow[];
  /** Opções pro select de SDR (no recorte de funil, pré filtro SDR). */
  sdrNames: string[];
  // ---------- SDR extensões (nova reforma) ----------
  timeInStage: TimeInStagePoint[];
  heatmapAgendadas: SDRHeatmapCell[];
  heatmapRealizadas: SDRHeatmapCell[];
  heatmapPropostas: SDRHeatmapCell[];
  heatmapVendas: SDRHeatmapCell[];
  serieReunioesDia: SDRReuniaoDiaPoint[];
  porData: SDRPorDataRow[];
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
  /** Média de dias entre última reunião realizada (sdr) e dataCompra (vendas). Null se não puder calcular. */
  cicloMedioReuniaoVenda: number | null;
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
  /** Acumulado real; null nos dias após "hoje" (linha realizado para). */
  realAcumulado: number | null;
  metaAcumulada: number | null;
  /** Trajetória projetada (run-rate). null antes do dia atual; no dia
   *  atual = realAcumulado (junção); depois = projeção linear até o fim. */
  projecao: number | null;
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
  /** Dia do mês alvo correspondente a "hoje" (1..diasNoMes). */
  pacingDiaAtual: number;
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
  /** Negócios criados no Clint (jul/2026+), atribuídos por UTM. */
  negociosCriados: number;
  /** Investimento ÷ Negócios criados. */
  custoPorNegocio: number;
  /** Negócios criados ÷ MQL. */
  mqlParaNegocio: number;
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
  /** Top 3 por Negócios criados (desc) */
  topNegocios: AnuncioCard[];
  /** Top 3 por agendamentos (desc) */
  topAgendamento: AnuncioCard[];
  /** Top 3 por reuniões realizadas (desc) */
  topReunioesRealizadas: AnuncioCard[];
  /** Exatamente 6 cards (3x2), os campeões por MQL desc */
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
  /** Negócios criados no Clint (jul/2026+) atribuídos à dimensão. */
  negociosCriados: number;
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
  porUtmContent: OrigemRow[];
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

// ---------- SDR extensões (nova reforma) ----------
export type TimeInStagePoint = {
  label: string;
  mediaDias: number;
  medianaDias: number;
  n: number;
};

export type SDRPorDataRow = {
  dia: Date;
  negociosCriados: number;
  taxaAgendamento: number;
  agendou: number;
  realizou: number;
  show: number;
  noShow: number;
  propostas: number;
  txProposta: number;
  valorProp: number;
  vendas: number;
  close: number;
};
