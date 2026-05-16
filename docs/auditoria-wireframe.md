# Auditoria de conformidade ao wireframe

Comparação 1:1 entre `dashboard metta paliativo/dashboard-wireframes.html`
(seções `#pX`) e as páginas implementadas. 3 eixos por página:
**A) Layout/grid · B) Tipo de componente · C) Dados/calc & filtros.**

Visão Geral (`#p1`) já corrigida e validada — fora desta auditoria.

Mapa: p2=Tráfego `/trafego` · p3=SDR `/sdr` · p4=Vendas `/closer` ·
p6=Metas `/metas` · p7=Criativo `/anuncios` · p8=Origem `/origem`.

---

## P6 — Metas (`/metas`)  ·  SEVERIDADE: CRÍTICA

A página mais divergente. O wireframe é, no núcleo, **9 cards-gauge com
barra de progresso** + 1 gráfico de projeção + 1 bloco de pacing com
barras + tabela de histórico. A implementação trocou quase tudo por
tabelas e cards genéricos.

- **A Layout:** wireframe = parágrafo explicativo MTD → `g-3` (3 cards)
  *Topo do funil* → `g-3` *Conversões* → `g-3` *Fim do funil* → `g-2`
  (Projeção + Pacing) → tabela Histórico. Implementado = card "hero"
  Faturamento → tabela "Funil Meta×Real" → 4 cards de taxa → área
  Pacing → tabela "Pacing necessário" → tabela Histórico. **Estrutura
  completamente diferente.**
- **B Componente:** wireframe pede **9 cards com barra de progresso**
  (Investimento/MQL/CMQL · Agendamentos/Reun. ag./Reun. real. ·
  Vendas/Conversão/Faturamento), cada um valor vs meta + barra. Foi
  implementado como **tabela** ("Funil — Meta x Real") + hero + 4 cards
  soltos. O "Pacing" do wireframe é **bloco de 4 barras de progresso**
  (Faturamento/dia, Vendas/dia, MQL/dia, Investimento/dia) — virou
  **tabela** "Pacing necessário". "Projeção do mês" do wireframe tem
  linha realizado + linha projeção tracejada + linha meta + marcador
  vertical "hoje"; implementado só área real vs meta (sem projeção nem
  "hoje").
- **C Dados:** VERIFICADO — o calc já expõe real/meta/pct/gap por
  métrica (`tabelaFunil`/`MetricaMetaReal`) e as 4 taxas (`cardsTaxa`):
  o dado pros 9 gauges EXISTE, só está renderizado como tabela. O
  `pacingChart` tem só real+meta acumulados — **a série de projeção e o
  marcador "hoje" não existem no calc** (precisam ser adicionados, não
  é só UI). Filtro **Produto** (select) ausente.

## P4 — Closer (`/closer`)  ·  SEVERIDADE: ALTA

- **A Layout:** wireframe = `g-kpi` (5) → `g-2` [donut "Receita por
  funil" | área "Evolução de receita"] lado a lado → `card tall`
  "Vendas do período" → `card` "Performance por closer". Implementado =
  tudo **empilhado em coluna única** (donut e evolução não estão lado a
  lado). **Layout errado** (mesmo problema da Visão Geral antiga).
- **B Componente:** OK — donut, área+linha c/ meta tracejada, 2 tabelas
  são os tipos certos.
- **C Dados/filtros:** faltam filtros **Produto** e **Pagamento**
  (selects do wireframe). "Performance por closer" tem 2 colunas extras
  (Faturamento, Ticket médio) que não estão no wireframe.

## P2 — Tráfego (`/trafego`)  ·  SEVERIDADE: ALTA

- **A Layout:** wireframe = `g-kpi` (5) → `g-2-1` [coluna esquerda com
  2 cards empilhados: combo "Investimento, MQL e CMQL" + "MQL e CMQL
  por funil" | coluna direita: "Funil de tráfego"] → `card tall`
  "Ranking de mídia". Implementado = tudo **empilhado em coluna única**.
  **Layout errado.**
- **B Componente:** combo, barras agrupadas, funil e tabela são os
  tipos certos. **Extra não pedido:** grid "FunilResumo" de 6 cards
  (CPM/CPC/CTR/CPL/CMQL/Tx) que não existe no wireframe. **Faltando:**
  toolbar do Ranking — controle segmentado [Campanha | Conjunto de
  anúncio] + select Temperatura + busca.
- **C Dados:** VERIFICADO no calc — `funilTrafego`
  (`src/lib/calc/trafego.ts:191`) já é exatamente Impressões → Cliques
  → Visualizações de página → Leads → MQL. **Conformante, sem mudança
  de calc.** (Correção: a versão anterior desta auditoria supôs
  divergência sem checar — estava errado.)

## P3 — SDR (`/sdr`)  ·  SEVERIDADE: MÉDIA

- **A Layout:** OK — `g-kpi` (5) → grid 2-col [Funil SDR | Heatmap] →
  tabela "Performance por SDR". Estrutura bate com o wireframe (grid
  2-col só ativa em `xl`, ajuste menor).
- **B Componente:** OK — funil, heatmap, tabela.
- **C Dados/filtros:** faltam filtros **SDR** e **Status** (selects do
  wireframe). Etapas do "Funil SDR" VERIFICADAS no calc
  (`src/lib/calc/sdr.ts:96`) — já são Agendamentos → Reuniões marcadas
  → Realizadas → Propostas → Vendas. **Conformante.** (Correção: versão
  anterior pedia "verificar"; agora verificado e está certo.)

## P7 — Anúncios (`/anuncios`)  ·  SEVERIDADE: BAIXA

- **A Layout:** OK — `g-3` (Top CPL/CMQL/Vendas) → Galeria → `card
  tall` Ranking. Bate com o wireframe.
- **B Componente:** OK — mini-listas top, galeria de criativos, tabela
  15 colunas.
- **C Filtros:** falta filtro **Temperatura** (select do wireframe).

## P8 — Origem (`/origem`)  ·  SEVERIDADE: BAIXA (conforme)

- **A/B:** OK — 7 tabelas (UTM Source/Medium/Campaign, Qualificação,
  Cargo, Faixa de Faturamento c/ col. Qualif., Segmento). É exatamente
  o wireframe (que aqui também é só tabelas).
- **C:** apenas nomes de cabeçalho levemente diferentes ("Leads
  qualif" vs "Leads qualif.", "Agendamentos" vs "Agend.") — cosmético.

---

## Ordem de correção recomendada (pior → melhor)

1. **P6 Metas** — refazer estrutura: 9 gauge-cards + projeção completa +
   pacing em barras. (crítica)
2. **P4 Closer** — layout `g-2` (donut+evolução lado a lado) + filtros
   Produto/Pagamento.
3. **P2 Tráfego** — layout `g-2-1` + toolbar do Ranking; remover
   FunilResumo extra; verificar etapas do funil.
4. **P3 SDR** — filtros SDR/Status; verificar etapas do funil.
5. **P7 Anúncios** — filtro Temperatura.
6. **P8 Origem** — só ajuste cosmético de cabeçalhos (opcional).

Cada página, ao ser corrigida, é verificada contra seu `#pX` antes de
seguir para a próxima.

---

## Status final — 2026-05-16

Tudo verificado contra `#pX` via medição de DOM antes de deploy. No ar
em `dashboard-metta-perpetuo.vercel.app`.

- **P6 Metas** ✅ — 9 cards-gauge + projeção (série nova no calc) +
  pacing em barras + histórico. Aba "Metas" da planilha preenchida com
  as metas de Maio. Bug do mês-alvo corrigido (ancorado em `filters.to`).
- **P4 Closer** ✅ — donut + evolução lado a lado (`g-2`).
- **P2 Tráfego** ✅ — `g-2-1` (combo+barras | funil) + FunilResumo extra
  removido.
- **P3 SDR** ✅ — filtros SDR e Status (selects nativos, parse aditivo,
  default = no-op sem regressão).
- **P8 Origem** ✅ — 1ª coluna por tabela + cabeçalhos abreviados.
- **P7 Anúncios — Temperatura: BLOQUEADO.** O calc tem no-op consciente
  (`anuncios.ts:129`): o PRD não define os markers de temperatura
  (Frio/Quente/Advantage) em `campaignName`. Não shipado de propósito —
  select morto seria desonesto e marker chutado zeraria a página.
  **Pendência do usuário:** confirmar a convenção real dos markers.

Filtros que dependiam do mesmo plumbing e foram entregues: SDR/Status
(P3). Produto/Pagamento (P4) e Temperatura (P7) seguem fora — os dois
primeiros foram des-escopados pelo usuário ("só layout e gráficos"); o
terceiro está bloqueado por convenção de dado não documentada.
