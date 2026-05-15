# Inventário de completude — dashboard-metta

> Comparação exaustiva entre o wireframe HTML (`dashboard metta paliativo/dashboard-wireframes.html`), o PRD §5.2 (`dashboard metta paliativo/PRD.md`) e o que os `types.ts` + calcs do repo (`src/lib/calc/*`) atualmente expõem.
>
> Convenção: ✅ = presente; ❌ FALTANDO = previsto pelo wireframe/PRD e ausente no calc/types; ⚠ DIVERGE = existe mas com shape/semântica diferente.
>
> Mapeamento `id wireframe → rota app`:
>
> - p1 → Visão Geral (`/`)
> - p2 → Tráfego Pago (`/trafego`)
> - p3 → Comercial SDR (`/sdr`)
> - p4 → Comercial Closer (`/closer`)
> - p6 → Metas vs Realizado (`/metas`)
> - p7 → Anúncios (`/anuncios`)
> - p8 → Origem (`/origem`)

---

## Página: Visão Geral (p1, `/`)

### Filtros
- ✅ Período (`FilterState.from/to`) — wireframe tem date range com preset chips
- ✅ Funis multi-select chips (`FilterState.funis`) — wireframe mostra chips "Todos · Sala · Aplicação · Sessão · Isca · Reality"

### KPI Cards (wireframe mostra 10 cards em 2 linhas de 5)

**Linha 1:**
- ✅ Investido (`kpis.investimento`) — wireframe sub-info `CPL R$ 19,67`. ❌ FALTANDO sub-info CPL no result (precisa `kpis.cpl`).
- ❌ FALTANDO **Leads** (count total, não MQL) — wireframe mostra card "Leads · 2.300 · +12% vs mês ant.". Calc só expõe MQL. Adicionar `kpis.leads: number`.
- ❌ FALTANDO **leadsDelta** vs período anterior — wireframe mostra `+12% vs mês ant.` em verde/vermelho. Adicionar `kpis.leadsDelta: { value: number; direction: 'up' | 'down' } | null` (PRD §5.2.1.E linha 1206).
- ✅ MQL (`kpis.mql`) — sub-info wireframe `CMQL R$ 93,84 · Tx 20,9%`. CMQL existe (`kpis.cmql`). ❌ FALTANDO `kpis.txLeadParaMql: number` (MQL/Leads).
- ✅ Reuniões realizadas (`kpis.reunioes`) — sub-info wireframe `Show 65%`. ❌ FALTANDO `kpis.show: number` (Realizadas/Reuniões agendadas). Hoje só há `taxaShow` no SDR result.
- ✅ Vendas (`kpis.vendas`) — sub-info wireframe `Conv. R→V 18,4%`. ❌ FALTANDO `kpis.convReunParaVenda: number` (Vendas/Reuniões realizadas) — hoje só há `kpis.conversaoVendas` que é Vendas/MQL.

**Linha 2:**
- ✅ Receita (`kpis.faturamento`)
- ❌ FALTANDO **Ticket médio** — wireframe `R$ 41.428`. Adicionar `kpis.ticketMedio: number` (Faturamento/Vendas).
- ✅ ROAS (`kpis.roas`) — sub-info "acima da meta (5x)". ❌ FALTANDO comparação com meta (texto/booleano) — pode ser derivada no front se houver `kpis.roasMeta` ou hardcoded 5.
- ✅ CAC (`kpis.cac`)
- ❌ FALTANDO **Pipeline (proposta)** — wireframe `R$ 780k · 9 propostas em aberto`. Adicionar `kpis.pipeline: number` + `kpis.propostasEmAberto: number`. Fonte: `sum(sdr.valorProposta where envioProposta in {Sim, Fechada, Recusada})`.

### Gráficos

- ✅ **Funil consolidado** (`funilConsolidado: FunnelStep[]`) — wireframe mostra 5 etapas (Leads → MQL → Agendamentos → Reuniões realizadas → Vendas) mas calc tem 7 (Investimento + Impressões + Cliques + MQL + Agendamentos + Reuniões + Vendas). ⚠ DIVERGE: o funil "do mês" no wireframe começa em **Leads** (não Investimento/Impressões). PRD §5.2.1 confirma funil de 5 etapas começando em Leads. Considerar: ou (a) gerar funil de 5 etapas adicional `funilDoMes` em `VisaoGeralResult`, ou (b) deixar consumidor pular etapas do array atual.
- ✅ **Evolução diária combo** (`serieDiaria: DailyPoint[]`) — wireframe é combo "MQL · Reuniões Realizadas · Vendas + linha % Conv acumulada". DailyPoint tem `mql`, `reunioes`, `vendas`. ❌ FALTANDO `serieDiaria[].convMqlVenda: number | null` (linha % Conv acumulada do eixo direito) — PRD §5.2.1.E linha 1227.
- ❌ FALTANDO **Custo por etapa diário** (linha multi CPL/CMQL/CAC) — wireframe tem card dedicado com 3 séries em escala dupla. PRD §5.2.1.E linhas 1237/1494. Adicionar `custoPorEtapa: Array<{ dia: Date; cpl: number | null; cmql: number | null; cac: number | null }>`.
- ❌ FALTANDO **Distribuição por funil** (donut/barra empilhada) — wireframe tem donut MQL por funil (Sala/Aplicação/Sessão/Isca/Reality). PRD §5.2.1.E linhas 1238/1506. Adicionar `distribuicaoPorFunil: Array<{ funil: Funil; leads: number; mql: number; reunioes: number; vendas: number }>`.

### Tabelas

- ❌ FALTANDO **Tabela diária** (`.card.tall` no wireframe, 13 colunas + linha TOTAL) — PRD §5.2.1.E linhas 1245-1260, 1521-1547. Colunas: Data, Investimento, MQL, Custo por MQL, Agendamentos, MQL → Agend. (%), Reuniões agendadas, MQL → Reun. ag. (%), Reuniões realizadas, Show (%), Vendas, Conversão (%), Faturamento. Adicionar:
  - `tabelaDiaria: Array<{ dia: Date; investimento: number; mql: number; custoPorMql: number | null; agendamentos: number; mqlParaAgend: number | null; reunioesAgendadas: number; mqlParaReunAg: number | null; reunioesRealizadas: number; show: number | null; vendas: number; conversao: number | null; faturamento: number }>`
  - `tabelaDiariaTotal: <mesma shape sem dia>` (linha TOTAL com taxas recalculadas em cima dos totais, não média).

### Sugestões de update — `VisaoGeralResult`

```ts
export type VisaoGeralKPIs = {
  investimento: number;
  leads: number;                                // novo
  leadsDelta: { value: number; direction: 'up' | 'down' } | null; // novo
  cpl: number;                                  // novo
  mql: number;
  cmql: number;
  txLeadParaMql: number;                        // novo
  agendamentos: number;
  reunioesAgendadas: number;                    // novo (existe só em serie/funil)
  reunioes: number;                             // realizadas
  show: number;                                 // novo
  vendas: number;
  faturamento: number;
  ticketMedio: number;                          // novo
  cac: number;
  roas: number;
  conversaoVendas: number;                      // (Vendas/MQL) — manter
  convReunParaVenda: number;                    // novo (Vendas/Reuniões realizadas)
  pipeline: number;                             // novo
  propostasEmAberto: number;                    // novo
};

export type DailyPoint = {
  dia: Date;
  investimento: number;
  leads: number;                                // novo
  mql: number;
  cmql: number | null;                          // novo
  agendamentos: number;                         // novo
  reunioesAgendadas: number;                    // novo
  reunioes: number;
  vendas: number;
  faturamento: number;
  convMqlVenda: number | null;                  // novo (linha % conv. eixo direito)
};

export type CustoPorEtapaPoint = {
  dia: Date;
  cpl: number | null;
  cmql: number | null;
  cac: number | null;
};

export type DistribuicaoPorFunil = {
  funil: Funil;        // sala | aplica | sessao | isca | reality
  leads: number;
  mql: number;
  reunioes: number;
  vendas: number;
  faturamento: number; // novo — donut no wireframe é só MQL, mas tem variação por receita também (Closer)
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

export type VisaoGeralResult = {
  kpis: VisaoGeralKPIs;
  serieDiaria: DailyPoint[];
  funilConsolidado: FunnelStep[];          // manter (5+ etapas)
  custoPorEtapa: CustoPorEtapaPoint[];     // novo
  distribuicaoPorFunil: DistribuicaoPorFunil[]; // novo
  tabelaDiaria: TabelaDiariaRow[];         // novo
  tabelaDiariaTotal: Omit<TabelaDiariaRow, "dia"> & { etapa: "TOTAL" }; // novo
};
```

---

## Página: Tráfego Pago (p2, `/trafego`)

### Filtros
- ✅ Período (`from/to`)
- ✅ Funis chips multi-select (`funis`)
- ❌ FALTANDO **Temperatura** (Frio · Quente · Advantage · Todas) — toolbar interno da tabela Ranking. PRD §5.2.2.E linha 1727. Adicionar `filters.temperatura?: 'todas' | 'frio' | 'quente' | 'adv'` (extensão de `FilterState` ou param dedicado de tráfego).
- ❌ FALTANDO **Toggle Campanha/Adset** — segmented control da tabela. Adicionar `filters.rankingBy?: 'campanha' | 'adset'`.
- ❌ FALTANDO **Busca client-side** — input de busca na toolbar (filtro local, não server).

### KPI Cards (5 colunas no wireframe)

- ✅ Investido (`kpis.investimento`)
- ✅ Impressões (`kpis.impressoes`) — sub-info `CPM R$ 37,69`. ✅ CPM existe (`kpis.cpm`).
- ✅ Cliques (`kpis.cliques`) — sub-info `CTR 1,75% · CPC R$ 2,15`. ✅ CTR/CPC existem.
- ❌ FALTANDO card **Leads** (count total) — wireframe `Leads · 2.300 · CPL R$ 19,67 · Conv 11%`. Calc só tem MQL. Adicionar `kpis.leads: number`, `kpis.cpl: number`, `kpis.txLpLead: number` (Leads/LP Views).
- ✅ MQL (`kpis.mql`) — sub-info `CMQL R$ 93,84` ✅.

### Gráficos

- ✅ **Investimento, MQL e CMQL · diário** (`serieCombo: TrafegoComboPoint[]`) — wireframe é combo barras (Invest + MQL) + linha (CMQL). TrafegoComboPoint tem `investimento`, `cliques`, `mql`. ❌ FALTANDO `serieCombo[].cmql: number | null` (linha do gráfico). ❌ FALTANDO `serieCombo[].leads: number` (PRD §5.2.2.E menciona variantes).
- ❌ FALTANDO **MQL e CMQL por funil** (barras duplas) — wireframe tem dual bars por 5 funis. PRD §5.2.2.E linhas 1772-1778. Adicionar `mqlCmqlPorFunil: Array<{ funil: Funil; mql: number; cmql: number | null; investimento: number }>`.
- ✅ **Funil de tráfego** (`funilTrafego: FunnelStep[]`) — wireframe: Impressões → Cliques → LP Views → Leads → MQL. Calc tem as 5 etapas corretas ✅. ❌ FALTANDO métricas secundárias por etapa (CPM, CPC, CPL, CMQL) — wireframe mostra `CPM R$ 37,69`, `CTR 1,75% · CPC R$ 2,15` etc nos labels do funil. `FunnelStep` só tem `etapa/valor/conversaoEtapa`. Considerar adicionar `meta?: string` opcional ou objeto `funilTrafego: { impressoes, cliques, lpViews, leads, mql, cpm, cpc, ctr, cpl, cmql }` (PRD §5.2.2.E linhas 1701-1709).

### Tabela "Ranking de mídia"

Wireframe: 11 colunas. Calc tem 8 colunas em `TrafegoRankingRow`.

- ✅ Campanha (`campanha`)
- ✅ Invest. (`investimento`)
- ✅ Impr. (`impressoes`)
- ✅ CTR (`ctr`)
- ✅ CPC (`cpc`)
- ❌ FALTANDO **CPM** por campanha — wireframe tem coluna CPM. Adicionar `ranking[].cpm: number`.
- ❌ FALTANDO **LP Views** — wireframe tem `LP Views`. Adicionar `ranking[].lpViews: number`.
- ❌ FALTANDO **Leads** (total, não MQL) — wireframe tem `Leads · CPL`. Adicionar `ranking[].leads: number` e `ranking[].cpl: number`.
- ✅ MQL (`mql`)
- ✅ CMQL (`cmql`)
- ❌ FALTANDO suporte a **agrupamento por Adset** (toggle Campanha/Adset). Hoje só agrupa por `campaignName`. Implicar: o calc deve aceitar param `rankingBy` ou retornar dois arrays.
- ❌ FALTANDO **ordenação default por CMQL ascendente** — calc ordena por `investimento desc`. PRD §5.2.2.E linha 1807 e 1901 dizem CMQL ASC. (Decisão documentada no comentário do calc — divergência consciente, mas wireframe e PRD especificam CMQL.)

### Sugestões de update — `TrafegoResult`

```ts
export type TrafegoKPIs = {
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;        // novo
  cpl: number;          // novo
  txLpLead: number;     // novo (Leads/LP Views)
  mql: number;
  cmql: number;
  txLeadMql: number;    // novo (MQL/Leads)
};

export type TrafegoComboPoint = {
  dia: Date;
  investimento: number;
  cliques: number;
  leads: number;        // novo
  mql: number;
  cmql: number | null;  // novo
};

export type TrafegoFunilSummary = {
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
  nome: string;          // (era campanha) — pode ser campaign ou adset
  agrupamento: 'campanha' | 'adset'; // novo
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;          // novo
  lpViews: number;      // novo
  leads: number;        // novo
  cpl: number;          // novo
  mql: number;
  cmql: number;
};

export type TrafegoResult = {
  kpis: TrafegoKPIs;
  serieCombo: TrafegoComboPoint[];
  mqlCmqlPorFunil: TrafegoMqlCmqlPorFunil[];   // novo
  funilTrafego: FunnelStep[];                  // manter
  funilTrafegoResumo: TrafegoFunilSummary;     // novo (métricas secundárias)
  ranking: TrafegoRankingRow[];                // alargado
};
```

`FilterState` precisa de campos opcionais para tráfego (ou criar `TrafegoFilters` extension):

```ts
export type TrafegoFilters = FilterState & {
  temperatura?: 'todas' | 'frio' | 'quente' | 'adv';
  rankingBy?: 'campanha' | 'adset';
  busca?: string;       // se quiser filtrar server-side; senão client-side
};
```

---

## Página: Comercial SDR (p3, `/sdr`)

### Filtros
- ✅ Período
- ✅ Funil (`funis`) — wireframe mostra select "Todos" (não chips multi neste card; aceitável como dropdown)
- ❌ FALTANDO **SDR** (select com `distinct(sdr.quemAgendou)`) — wireframe e PRD §5.2.3 linha 1926. Adicionar `filters.sdr?: string`.
- ❌ FALTANDO **Status** (Todos · Agendada · Realizada · Não realizada · Reagendada · Cancelada) — wireframe e PRD §5.2.3 linha 1927. Adicionar `filters.status?: string`.

### KPI Cards (5 no wireframe)

- ✅ Agendamentos (`kpis.agendamentos`)
- ❌ FALTANDO **Reuniões agendadas** (no calendário) — wireframe mostra card separado de "Agendamentos". Calc fundiu em `kpis.reunioes` (que é só realizadas). PRD §5.2.3 KPI #2 = `count(sdr where dataReuniao between dates)` (não só realizadas). Adicionar `kpis.reunioesAgendadas: number`.
- ✅ Realizadas (`kpis.reunioes`) — sub-info wireframe `Show 65%`. ✅ `kpis.taxaShow` existe.
- ❌ FALTANDO **Propostas enviadas** — wireframe `12 · Tx 31,5% das realizadas`. Adicionar `kpis.propostas: number` e `kpis.taxaProposta: number`.
- ❌ FALTANDO **Valor em propostas** — wireframe `R$ 780k`. Adicionar `kpis.valorPropostas: number` (somar `sdr.valorProposta where envioProposta in {Sim,Fechada,Recusada}`).
- ⚠ DIVERGE: KPIs atuais incluem `leadsRecebidos`, `tentativasContato`, `taxaContato`, `taxaAgendamento` que **não aparecem no wireframe nem no PRD**. Não remover (podem ser úteis), mas marcar como extra.

### Gráficos

- ❌ FALTANDO **Funil SDR** (5 etapas — Agendamentos → Reuniões marcadas → Realizadas → Propostas → Vendas) — PRD §5.2.3 linhas 1940-1948 e wireframe. Adicionar `funil: FunnelStep[]` ao result (ou estrutura nomeada `funilSdr`).
- ✅ **Heatmap** (`heatmap: SDRHeatmapCell[]`) — wireframe é 7 dias × 14 horas (07h-20h). Calc gera 7×24. ⚠ Front pode filtrar — não há gap real, mas tipo poderia ser restrito. Aceitável.

### Tabela "Performance por SDR"

Wireframe: 9 colunas. Calc `SDRRow` tem 8.

- ✅ SDR (`sdr`)
- ✅ Agendou (`agendamentos`)
- ✅ Realizou (`reunioes`)
- ✅ Show (`taxaShow`)
- ❌ FALTANDO **Propostas** por SDR — wireframe coluna #5. Adicionar `porSdr[].propostas: number`.
- ❌ FALTANDO **Tx prop.** — wireframe coluna #6. Adicionar `porSdr[].txProposta: number`.
- ❌ FALTANDO **Valor prop.** — wireframe coluna #7. Adicionar `porSdr[].valorProp: number`.
- ❌ FALTANDO **Vendas** por SDR — wireframe coluna #8. Adicionar `porSdr[].vendas: number` (join via emails das reuniões → `vendas.email`).
- ❌ FALTANDO **Close** (Vendas/Propostas) — wireframe coluna #9. Adicionar `porSdr[].close: number`.
- ⚠ Campos `leadsAtribuidos`, `tentativas`, `taxaContato`, `taxaAgendamento` em `SDRRow` não aparecem no wireframe — extras opcionais.

### Sugestões de update — `SDRResult`

```ts
export type SDRKpis = {
  agendamentos: number;
  reunioesAgendadas: number;     // novo (separado de realizadas)
  realizadas: number;             // (era reunioes)
  taxaShow: number;
  propostas: number;              // novo
  taxaProposta: number;           // novo
  valorPropostas: number;         // novo
  // legado opcional (manter se já consumido):
  leadsRecebidos?: number;
  tentativasContato?: number;
  taxaContato?: number;
  taxaAgendamento?: number;
};

export type SDRRow = {
  sdr: string;
  agendou: number;                // (era agendamentos)
  realizou: number;               // (era reunioes)
  show: number;                   // (era taxaShow)
  propostas: number;              // novo
  txProposta: number;             // novo
  valorProp: number;              // novo
  vendas: number;                 // novo
  close: number;                  // novo
};

export type SDRResult = {
  kpis: SDRKpis;
  funilSdr: FunnelStep[];          // novo — Agendamentos→Marcadas→Realizadas→Propostas→Vendas
  heatmap: SDRHeatmapCell[];
  porSdr: SDRRow[];
};
```

---

## Página: Comercial Closer (p4, `/closer`)

### Filtros
- ✅ Período
- ✅ Funil (`funis`)
- ❌ FALTANDO **Produto** (Todos · Mentoria · Up-sell · Down-sell · distinct(vendas.produto)) — wireframe e PRD §5.2.4 linha 2173. `FilterState.produto` existe ⚠ porém não é consumido em `calcCloser` (closer.ts não filtra por produto).
- ❌ FALTANDO **Pagamento** (Todos · Pix · Cartão à vista · Cartão parcelado · Boleto · Transferência) — wireframe e PRD §5.2.4 linha 2174. Adicionar `filters.pagamento?: string`.

### KPI Cards (5 no wireframe)

- ✅ Vendas (`kpis.vendas`)
- ✅ Receita (`kpis.faturamento`)
- ✅ Ticket médio (`kpis.ticketMedio`)
- ❌ FALTANDO **ROAS** — wireframe `6,4x · acima da meta`. Calc atual de closer não retorna ROAS. PRD §5.2.4.E linha 2259 menciona que precisa de `fb_todos` ou placeholder. Adicionar `kpis.roas: number | null` (requer adicionar `fb_todos` ao input de `calcCloser`).
- ❌ FALTANDO **Ciclo médio** — wireframe `14 dias · inscrição → aceite`. Adicionar `kpis.cicloMedio: number | null` (média de `dias(dataCompra - dataInscricao)` com join lead.email; ignorar negativos).
- ⚠ EXTRA: `reunioes`, `propostas`, `taxaProposta`, `taxaFechamento` em `CloserKpis` são úteis pra "Performance closers" mas não aparecem nos KPI cards do header.

### Gráficos

- ❌ FALTANDO **Receita por funil (Donut)** — wireframe mostra donut com 5 funis (Sala/Aplicação/Sessão/Isca/Reality) + valor central R$ 290k. PRD §5.2.4.E linhas 2262/2383. Adicionar `receitaPorFunil: Array<{ funil: Funil | 'up-sell' | 'outros'; receita: number; pct: number }>`.
- ❌ FALTANDO **Evolução de receita 12 meses** (Area + Line + meta tracejada) — wireframe + PRD §5.2.4.E linhas 2263/2400. Adicionar `evolucao12Meses: Array<{ mes: Date; receita: number; meta: number | null }>` (precisa `MetaRow[]` no input).

### Tabelas

- ❌ FALTANDO **Vendas do período** (tabela tall, 8 colunas) — wireframe + PRD §5.2.4.E linhas 2264-2273/2409. Colunas: Data · Comprador · Funil · Produto · Valor · SDR · Pagamento · Ciclo. Adicionar:
  ```ts
  vendasDoPeriodo: Array<{
    data: Date;
    comprador: string;     // vendas.nomeComprador
    funil: string;
    produto: string;
    valor: number;
    sdr: string | null;    // join via sdr.email = vendas.email → sdr.quemAgendou
    pagamento: string;     // vendas.formaPagamento
    ciclo: number | null;  // dias entre inscrição e compra
  }>
  ```
- ⚠ DIVERGE **Performance por closer** (`porCloser`) — wireframe tem 9 colunas: Closer · Agendou · Realizou · Show · Propostas · Tx prop. · Valor prop. · Vendas · Close. Calc atual `CloserRow` tem: closer, reunioes, propostas, vendas, faturamento, ticketMedio, taxaProposta, taxaFechamento.
  - ❌ FALTANDO `agendou` (sdr.dataAgendamento por responsavel = closer)
  - ❌ FALTANDO `show` (Realizou/Agendou)
  - ❌ FALTANDO `valorProp` (sum sdr.valorProposta)
  - ❌ FALTANDO `close` separadamente (existe `taxaFechamento` que é Vendas/Propostas — ok, renomear).
  - ⚠ Coluna "Faturamento" extra que está no calc mas não no wireframe da tabela closer (está nos KPI cards superiores).

### Sugestões de update — `CloserResult`

```ts
export type CloserKpis = {
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  roas: number | null;            // novo (precisa fb_todos)
  cicloMedio: number | null;      // novo
  // mantidos pra Performance closers:
  reunioes: number;
  propostas: number;
  taxaProposta: number;
  taxaFechamento: number;
};

export type CloserRow = {
  closer: string;
  agendou: number;                // novo
  realizou: number;               // (era reunioes)
  show: number;                   // novo
  propostas: number;
  txProposta: number;             // (era taxaProposta)
  valorProp: number;              // novo
  vendas: number;
  close: number;                  // (era taxaFechamento)
  faturamento: number;
  ticketMedio: number;
};

export type CloserReceitaPorFunil = {
  funil: string;                  // sala | aplica | sessao | isca | reality | up-sell | outros
  receita: number;
  pct: number;                    // 0..1
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

export type CloserResult = {
  kpis: CloserKpis;
  receitaPorFunil: CloserReceitaPorFunil[];        // novo
  evolucao12Meses: CloserEvolucao12MesesPoint[];   // novo
  vendasDoPeriodo: CloserVendaRow[];               // novo
  porCloser: CloserRow[];
};
```

Inputs do calc precisam ganhar `fb_todos`, `leads` (pra ciclo), `Metas` (pra linha de meta no evolução 12 meses), e `FilterState` precisa de `pagamento`.

---

## Página: Metas vs Realizado (p6, `/metas`)

> **Nota:** PRD §5.2.7 marca explicitamente que o wireframe HTML atual da p6 é a **estrutura antiga** (3 cards progress + Projeção + Pacing + Histórico) e a **especificação oficial é a do PRD** (Hero KPI + Tabela funil meta×real + 4 cards de taxa + gráfico de pacing).

O inventário abaixo lista o que o PRD prescreve (definição oficial) vs o que o calc atual entrega — e também lista o que o **wireframe legado** mostra, em separado, pra rastreamento.

### Filtros
- ✅ Período
- ✅ Funil (`funis`)
- ⚠ Produto (`FilterState.produto`) existe no tipo mas **não é consumido em `calcMetas`** — PRD §5.2.7.E linha 3200 manda default "Mentoria". Adicionar filtragem por produto e default.

### Hero KPI — Faturamento (PRD oficial)
- ❌ FALTANDO **Hero faturamento** (banner grande) — PRD §5.2.7.E linhas 3224-3243. Estrutura: `realFaturamento`, `metaFaturamentoMtd`, `pctAtingimento`, `gap`, `projecaoFimDoMes`. Calc atual não tem nada equivalente.

### Tabela funil meta×real (PRD oficial)
- ❌ FALTANDO `tabelaFunil: MetricaMetaReal[]` (7 linhas: Investimento, MQL, Agendamentos, Reuniões agendadas, Reuniões realizadas, Vendas, Faturamento) com colunas Real · Meta MTD · % · Gap.
- ⚠ Calc atual retorna `rows: MetaComparacao[]` — shape parecida, mas:
  - Linhas vêm da aba Metas (não da especificação fixa de 7 etapas) — wireframe/PRD quer 7 etapas obrigatórias, mesmo se meta da linha não existir (mostrar `—`).
  - Falta campo `gap`.
  - Falta campo `nome` semântico (usa `metrica` cru).

### 4 cards de taxa (PRD oficial)
- ❌ FALTANDO `cardsTaxa: Array<{ nome; realValor; metaValor; isInverse?: boolean }>` com CMQL · Tx Agendamento/MQL · Tx Reun. realizada/Reun. agendada · Conversão Vendas/Reun. realizada. PRD §5.2.7.E linhas 3232-3237.

### Gráfico de Pacing (PRD oficial)
- ❌ FALTANDO `pacingChart: Array<{ date: Date; realAcumulado: number; metaAcumulada: number | null }>`. PRD §5.2.7.E linhas 3238-3242.

### Cards/blocos do wireframe legado (p6 HTML)

Estes blocos APARECEM no wireframe mas o PRD explicita que esta página foi redesenhada — mantidos no inventário caso queira preservar conteúdo legado:
- 3 cards topo (Investimento · MQL · CMQL) com progress bar — substituídos pelos "cards de taxa" do PRD.
- 3 cards meio (Agendamentos · Reuniões agendadas · Reuniões realizadas) — substituídos pela tabela funil.
- 3 cards fundo (Vendas · Conversão de vendas · Faturamento) — substituídos pelo Hero KPI + tabela funil.
- Card "Projeção do mês" (gráfico com linha realizado + linha tracejada projeção + meta horizontal) — substituído pelo Pacing chart.
- Card "Pacing" (4 progress rows: Faturamento/dia, Vendas/dia, MQL/dia, Investimento/dia necessário) — ❌ FALTANDO no calc. Pode coexistir com o Pacing chart do PRD se quiserem manter. Adicionar `pacingNecessario: Array<{ metrica: string; valorPorDia: number; pctAvancado: number }>`.
- Tabela "Histórico mensal" (10 colunas: Mês, Invest., MQL, CMQL, Agend., Reun. real., Vendas, Conv., Faturamento, % meta) — ❌ FALTANDO. Equivale ao `evolucao12Meses` do Closer mas mais detalhado por mês. Considerar `historicoMensal: Array<{ mes: Date; investimento: number; mql: number; cmql: number | null; agendamentos: number; reunioesRealizadas: number; vendas: number; conversao: number | null; faturamento: number; pctMeta: number | null }>`.

### Sugestões de update — `MetasResult`

```ts
export type MetricaMetaReal = {
  nome: string;                  // "Investimento", "MQL", ..., "Faturamento"
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
  nome: string;                  // "CMQL", "Tx Agendamento/MQL", ...
  realValor: number | null;
  metaValor: number | null;
  isInverse?: boolean;           // CMQL = menor é melhor
};

export type MetasPacingPoint = {
  date: Date;
  realAcumulado: number;
  metaAcumulada: number | null;
};

export type MetasPacingNecessario = {
  metrica: string;               // "Faturamento/dia", "Vendas/dia", ...
  valorPorDia: number;
  pctAvancado: number;           // 0..1
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

export type MetasResult = {
  hero: MetasHero;                                  // novo
  tabelaFunil: MetricaMetaReal[];                   // novo (7 linhas fixas)
  cardsTaxa: MetasCardTaxa[];                       // novo
  pacingChart: MetasPacingPoint[];                  // novo
  pacingNecessario: MetasPacingNecessario[];        // novo (do wireframe legado)
  historicoMensal: MetasHistoricoRow[];             // novo (do wireframe legado)
  // shape legado opcional pra compat:
  rows?: MetaComparacao[];
  resumoPorFunil?: Array<{ funil: string; metaTotal: number; realizadoTotal: number; atingimento: number }>;
};
```

---

## Página: Anúncios (p7, `/anuncios`)

### Filtros
- ✅ Período
- ✅ Funil (`funis`)
- ❌ FALTANDO **Temperatura** (Todas · Frio · Quente · Advantage) — wireframe e PRD §5.2.5 linha 2549. Adicionar `filters.temperatura?: 'todas' | 'frio' | 'quente' | 'adv'`.

### 3 cards "Top por…"

Wireframe mostra 3 cards lado a lado (Top por CPL · Top por CMQL · Top por vendas), cada um com top 3 anúncios + métrica chave + contagem secundária.

- ❌ FALTANDO **Top por CPL** — PRD §5.2.5 linha 2479. Calc atual só tem `topRoas`. Adicionar `topCpl: AnuncioCard[]` (top 3 com `leads > 0`, ordenado por CPL ASC). ❌ FALTANDO campo `cpl` em `AnuncioCard`.
- ❌ FALTANDO **Top por CMQL** — PRD §5.2.5 linha 2480. Adicionar `topCmql: AnuncioCard[]` (top 3 com `mql > 0`, ordenado por CMQL ASC). ✅ `cmql` já existe em `AnuncioCard`.
- ❌ FALTANDO **Top por vendas** — PRD §5.2.5 linha 2481. Adicionar `topVendas: AnuncioCard[]` (top 3 com `vendas > 0`, ordenado DESC).
- ⚠ `topRoas` existe no calc atual mas não está no wireframe nem no PRD da p7. Manter ou remover? Recomenda-se: remover do contrato público ou marcar como extra opcional.

### Galeria de criativos

Wireframe mostra grid 4 colunas com thumbnail + botão Instagram + nome + 3 métricas (CPL · CMQL · Vendas).

- ✅ `galeria: AnuncioCard[]` (até 12) existe.
- ❌ FALTANDO **`thumbnailUrl`** (de `ads_links.imageUrl`) — wireframe mostra thumbnail real. Adicionar `AnuncioCard.thumbnailUrl: string`.
- ❌ FALTANDO **`instagramPermalink`** (de `ads_links.instagram_permalink_url`) — wireframe tem botão IG abrindo permalink. Adicionar `AnuncioCard.instagramPermalink: string`.
- ❌ FALTANDO **`cpl`** em `AnuncioCard` — wireframe mostra `CPL R$ 15,40` no info do card.
- ❌ FALTANDO **`leads`** (count, separado de MQL) em `AnuncioCard` — wireframe mostra Leads na tabela e implícito no CPL.

### Tabela "Ranking de anúncios" (card tall)

Wireframe: 15 colunas. Calc atual `AnuncioCard` tem 12 (faltando colunas downstream).

- ✅ Anúncio (`nome`)
- ✅ Invest. (`investimento`)
- ✅ Impr. (`impressoes`)
- ✅ CTR (`ctr`)
- ❌ FALTANDO **CPC** — wireframe coluna #5. Adicionar `AnuncioCard.cpc: number`.
- ✅ CPM (`cpm`)
- ❌ FALTANDO **LP Views** — wireframe coluna #7. Adicionar `AnuncioCard.lpViews: number`.
- ❌ FALTANDO **Leads** (total) — wireframe coluna #8. Adicionar `AnuncioCard.leads: number`.
- ❌ FALTANDO **CPL** — wireframe coluna #9. Adicionar `AnuncioCard.cpl: number`.
- ✅ MQL (`mql`)
- ✅ CMQL (`cmql`)
- ❌ FALTANDO **Agend.** — wireframe coluna #12. Adicionar `AnuncioCard.agendamentos: number` (count sdr where utmContentSnap matches adName).
- ❌ FALTANDO **Reun. ag.** — wireframe coluna #13. Adicionar `AnuncioCard.reunioesAgendadas: number`.
- ❌ FALTANDO **Reun. real.** — wireframe coluna #14. Adicionar `AnuncioCard.reunioesRealizadas: number`.
- ✅ Vendas (`vendas`)
- ⚠ `tabelaAnuncios` deve ser array separado de `galeria` (PRD §5.2.5.E linhas 2613/2733-2737), com critério "Invest > 0 OU Leads > 0" e sem limite de 12.

### Fonte de dados ausente: aba `ads links`

- ❌ FALTANDO **schema `AdsLinkRow`** em `src/lib/sheets/schemas.ts` — PRD §5.2.5.E linhas 2556-2562:
  ```ts
  export const AdsLinkRowSchema = z.object({
    name: zString,
    instagramPermalink: zString,
    imageUrl: zString,
  });
  ```
- ❌ FALTANDO **`adsLinks?: AdsLinkRow[]`** em `RawData`.
- ❌ FALTANDO consumo em `calcAnuncios` (join por `normalizeForMatch(adName)`).

### Sugestões de update — `AnunciosResult` + `AdsLinkRow`

```ts
// schemas.ts — adicionar:
export const AdsLinkRowSchema = z.object({
  name: zString,
  instagramPermalink: zString,
  imageUrl: zString,
});
export type AdsLinkRow = z.infer<typeof AdsLinkRowSchema>;

// types.ts — adicionar/atualizar:
export type AnuncioCard = {
  adName: string;                     // (era utmContent/nome — unificar)
  // tráfego
  investimento: number;
  impressoes: number;
  cliques: number;
  lpViews: number;                    // novo
  ctr: number;
  cpc: number;                        // novo
  cpm: number;
  // downstream (via utm_content)
  leads: number;                      // novo
  cpl: number;                        // novo
  mql: number;
  cmql: number;
  agendamentos: number;               // novo
  reunioesAgendadas: number;          // novo
  reunioesRealizadas: number;         // novo
  vendas: number;
  faturamento: number;
  receita: number;                    // alias do faturamento? padronizar
  roas: number;
  // enriquecimento via ads_links
  thumbnailUrl: string;               // novo, "" se não houver match
  instagramPermalink: string;         // novo, "" se vazio na fonte
};

export type AnunciosResult = {
  topCpl: AnuncioCard[];              // novo
  topCmql: AnuncioCard[];             // novo
  topVendas: AnuncioCard[];           // novo
  galeria: AnuncioCard[];             // mantido (até 12)
  tabelaAnuncios: AnuncioCard[];      // novo (todos com atividade no período)
};

export type AnunciosFilters = FilterState & {
  temperatura?: 'todas' | 'frio' | 'quente' | 'adv';
};

// RawData — adicionar:
export type RawData = {
  fb_todos: FbTodosRow[];
  leads: LeadRow[];
  sdr: SdrRow[];
  vendas: VendaRow[];
  ads_links?: AdsLinkRow[];           // novo
  Metas?: MetaRow[];
};
```

---

## Página: Origem (p8, `/origem`)

### Filtros
- ✅ Período
- ✅ Funis chips multi-select (`funis`)

### Estrutura (7 cards/tabelas empilhados)

Wireframe e PRD §5.2.6 mostram **7 cards**, um para cada dimensão. Calc atual `OrigemResult` retorna `porCategoria: Array<{categoria; rows; total}>` apenas para **categorias derivadas de UTM Source** (facebook, instagram, google, organico, indicacao, evento, outros).

⚠ DIVERGE FUNDAMENTAL: o calc atual produz 7 buckets **por classificação de utm_source**, enquanto wireframe/PRD pedem 7 **dimensões diferentes**:

1. ❌ FALTANDO **Por UTM Source** (distinct(`leads.utmSource`)) — wireframe linhas 1334-1340. Calc atual classifica em 7 categorias agregadas, mas wireframe quer linhas brutas por `utmSource` (ex: `ig`, `fb`, `MetaAds_Adv`, `google`).
2. ❌ FALTANDO **Por UTM Medium** (distinct(`leads.utmMedium`)) — wireframe linhas 1344-1354. Ex linhas: `paid`, `3% Alunos Mentoria`, `organic`, `referral`.
3. ❌ FALTANDO **Por UTM Campaign** (distinct(`leads.utmCampaign`)) — wireframe linhas 1359-1367.
4. ❌ FALTANDO **Por Qualificação** (Enterprise / MQL 1 / MQL 2) — wireframe linhas 1373-1379. Usa `normalizeQualif(lead.qualificacao)`.
5. ❌ FALTANDO **Por Cargo** (Empresário / Sócio / CEO / Diretor de vendas / Gerente / Outros) — wireframe linhas 1385-1394. Lista fixa (`leads.cargo`).
6. ❌ FALTANDO **Por Faixa de Faturamento** (7 faixas qualificadas) — wireframe linhas 1400-1410. Lista fixa em `FATURAMENTO_FAIXAS_QUALIFICADAS` (PRD §5.2.6.E linhas 3020-3025). Mostra coluna extra "Qualif." (Enterprise/MQL 1/MQL 2) — wireframe coluna 2 (única página com 9 colunas).
7. ❌ FALTANDO **Por Segmento de Mercado** (Varejo / Serviços / Indústria / Tecnologia / Agronegócio / Marketing) — wireframe linhas 1418-1425.

### Colunas-métrica (idênticas em todos os 7 cards)

Wireframe: Origem · Leads qualif. · MQL · Agend. · Reun. ag. · Reun. real. · Vendas · Faturamento (8 colunas).

`OrigemRow` atual:
- ✅ `origem`
- ✅ `leads` — wireframe usa label "Leads qualif." (só MQL). ⚠ Semântica: calc atual faz `m.leads += 1` para todo lead, não só MQL. PRD §5.2.6 linha 2883 diz "Leads qualif." = `count(leads onde qualificacao matches MQL_PATTERNS)`. Considerar renomear/refinar.
- ✅ `mql`
- ✅ `agendamentos`
- ❌ FALTANDO **`reunioesAgendadas`** — calc atual só tem `reunioes` (realizadas). Wireframe tem 2 colunas separadas. Adicionar `OrigemRow.reunioesAgendadas: number`.
- ✅ `reunioes` (realizadas)
- ✅ `vendas`
- ✅ `faturamento`
- ⚠ `conversaoLeadVenda` em `OrigemRow` está no calc mas NÃO no wireframe — extra ok.

### Sugestões de update — `OrigemResult`

```ts
export type OrigemRow = {
  dimensao: string;            // (era origem) — universal
  leadsQualif: number;         // count(leads onde MQL)
  mql: number;                 // alias de leadsQualif na maioria
  agendamentos: number;
  reunioesAgendadas: number;   // novo
  reunioesRealizadas: number;  // (era reunioes)
  vendas: number;
  faturamento: number;
  // opcional:
  qualif?: 'Enterprise' | 'MQL 1' | 'MQL 2';  // só usado em "Por Faixa de Faturamento"
};

export type OrigemResult = {
  porUtmSource: OrigemRow[];
  porUtmMedium: OrigemRow[];
  porUtmCampaign: OrigemRow[];
  porQualificacao: OrigemRow[];     // sempre Enterprise / MQL 1 / MQL 2
  porCargo: OrigemRow[];             // lista fixa de 6
  porFaturamento: OrigemRow[];       // 7 faixas qualificadas (com coluna `qualif`)
  porSegmento: OrigemRow[];          // 6 segmentos
  // shape legado opcional:
  porCategoria?: Array<{ categoria: string; rows: OrigemRow[]; total: OrigemRow }>;
};
```

`shared.ts` já tem `normalizeQualif` — usar pra `porQualificacao`. Pra `porFaturamento` é preciso usar `lead.faturamento` (string da faixa) + classificar MQL/Enterprise via `lead.qualificacao` ou `normalizeQualif`.

---

## Resumo de gaps por página

| Página | Filtros faltando | KPIs faltando | Gráficos/blocos faltando | Tabelas faltando/incompletas | Campos novos no result |
|---|---|---|---|---|---|
| **Visão Geral** | 0 | 5 (leads, leadsDelta, ticketMedio, pipeline, propostasEmAberto + sub-infos cpl/show/convReunVenda/txLeadMql) | 3 (custo por etapa, distribuição por funil, ajuste no funil consolidado) | 1 (tabela diária 13 colunas + total) | ~25 |
| **Tráfego Pago** | 3 (temperatura, rankingBy, busca) | 1 KPI inteiro (Leads) + sub-infos | 1 bloco (MQL e CMQL por funil) + métricas secundárias do funil | 1 ranking incompleto (5 colunas faltando + ordenação + adset toggle) | ~18 |
| **Comercial SDR** | 2 (sdr, status) | 4 (reunioesAgendadas, propostas, taxaProposta, valorPropostas) | 1 (Funil SDR de 5 etapas) | Performance por SDR (5 colunas faltando) | ~12 |
| **Comercial Closer** | 1 (pagamento) + 1 não consumido (produto) | 2 (roas, cicloMedio) | 2 (donut Receita por funil, evolução 12 meses + meta) | 2 (Vendas do período tabela inteira; Performance closer 4 colunas faltando) | ~20 |
| **Metas vs Realizado** | 1 não consumido (produto) | Hero KPI inteiro (5 campos) | 1 (Pacing chart) + Pacing necessário (legacy) | 2 (Tabela funil meta×real 7 linhas; Histórico mensal) | ~17 |
| **Anúncios** | 1 (temperatura) | 0 (3 cards "Top por" são listas, não KPIs no header) | 3 listas (topCpl, topCmql, topVendas) + thumbnail/IG na galeria | Tabela ranking 7 colunas faltando + array dedicado `tabelaAnuncios` + aba `ads links` inteira | ~14 + schema novo |
| **Origem** | 0 | n/a | n/a | **6 tabelas inteiras faltando** (todas exceto a aproximação atual via UTM source) + 1 coluna faltando (reunioesAgendadas) + semântica "Leads qualif." | ~7 (renomeações + 6 listas novas) |

### Página com mais gaps absolutos: **Origem (p8)**
6 das 7 tabelas previstas estão completamente ausentes — o calc atual produz uma 8ª estrutura distinta (categorias agregadas de UTM Source) que não corresponde a nenhum dos cards do wireframe. Refactor de maior superfície.

### Página com mais gaps em superfície de result type: **Visão Geral (p1)**
~25 campos novos somando KPIs + sub-infos + 4 estruturas inteiras (`custoPorEtapa`, `distribuicaoPorFunil`, `tabelaDiaria`, `tabelaDiariaTotal`). É a página mais "rica" do wireframe.

### Página mais próxima do PRD: **Origem (calc atual)** ironicamente — mas pra estrutura ERRADA
Em termos de KPIs/blocos esperados: **Tráfego Pago** é a mais próxima — KPIs principais existem, falta só o card Leads e enriquecimento das estruturas; ranking já existe (faltam colunas e toggle Adset).

### Prioridade de implementação sugerida

Ordenação por impacto x custo:

1. **Visão Geral (p1)** — alto impacto (página default `/`), gap concentrado em campos novos no result (24-25), todas dependências de dados já existem (`fb_todos`, `leads`, `sdr`, `vendas`). Não há schema novo. **Implementar primeiro.**
2. **Comercial SDR (p3)** — fix surgical em `SDRKpis` e `SDRRow`. Sem dependências externas novas. Funil SDR é trivial. Dados já existem (`sdr` tem `envioProposta`, `valorProposta`, `responsavel`).
3. **Tráfego Pago (p2)** — adicionar `leads`, `cpl`, `cpm` por linha do ranking + toggle Campanha/Adset + temperatura. Dados já existem.
4. **Comercial Closer (p4)** — adicionar Donut + Evolução 12 meses + tabela Vendas do período + colunas extras em `porCloser`. Requer estender input do calc com `fb_todos`, `leads`, `Metas`.
5. **Origem (p8)** — refactor: trocar `porCategoria` por 7 estruturas dedicadas. Dados já existem (lead tem cargo, faturamento, segmento). Trabalho maior em volume mas baixo risco.
6. **Anúncios (p7)** — depende de **criar a aba `ads links` na planilha + schema novo (`AdsLinkRow`) + sync workflow externo** (PRD §5.2.5.E linha 2553 menciona `sync-ads-link.yml` do repo `metta-meta-sync`). Sem esses, thumbnail/IG ficam vazios e a página fica funcional mas incompleta. Bloqueada por infra externa.
7. **Metas vs Realizado (p6)** — depende de a aba `Metas` estar populada na planilha (`MetaRow` já existe no schema, mas tabela pode estar vazia). PRD §5.2.7 explicitamente coloca esta como "fase 4.7 — última página implementada". Refactor mais profundo do calc (de `rows: MetaComparacao[]` para 5 estruturas novas).

---

## Estruturas/abas novas necessárias fora do `types.ts`

- **`src/lib/sheets/schemas.ts`:**
  - Adicionar `AdsLinkRowSchema` + `AdsLinkRow` + `ADS_LINKS_COLUMN_MAP` (3 colunas: name, instagramPermalink, imageUrl).
- **`src/lib/calc/types.ts`:**
  - Estender `FilterState` com `produto`, `pagamento`, `temperatura`, `rankingBy`, `sdr`, `status`, `busca` (todos opcionais) ou criar tipos `*Filters` por página.
  - Estender `RawData` com `ads_links?: AdsLinkRow[]`.
- **Aba na planilha** (operacional, não código):
  - `ads links` — alimentada por workflow externo, sync 1×/dia.
  - `Metas` — alimentada manualmente pelo Alisson, formato definido em PRD §5.2.7.E linhas 3138-3164.
