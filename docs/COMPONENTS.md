# Catálogo de componentes — dashboard-metta

Inventário dos componentes reutilizáveis, com props reais extraídas do código.
Serve para **reaproveitar em outros dashboards**: cole este arquivo (ou o trecho
relevante) numa sessão nova do Claude Code e ele saberá usar os componentes sem
inventar API.

Última varredura: 63 componentes (19 dashboard, 27 primitivos `ui/`, 17 raiz).

> **Vitrine visual:** a rota **`/componentes`** renderiza cada componente deste
> catálogo com dados fictícios, para inspeção e refinamento individual. Fonte em
> `src/app/(dashboard)/componentes/page.tsx`. Ao alterar um componente, veja o
> efeito lá primeiro — a vitrine não depende de Sheets nem de cache.

---

## Como reusar em outro projeto (ordem obrigatória)

A dependência é em camadas. Portar fora de ordem gera erro de build ou componente
sem estilo:

```
1. Tokens CSS        → globals.css (:root + @layer components)
2. Primitivos        → src/components/ui/* (shadcn: button, card, popover…)
3. Utilitários       → cn(), formatBRL(), formatPercent()
4. Componentes       → src/components/dashboard/*
```

### Camada 1 — Tokens (sem isso nada tem estilo)

Todo componente deste catálogo depende de 3 classes utilitárias e das variáveis de
cor. Copie para o `globals.css` do projeto novo:

```css
@layer components {
  .surface-card {
    @apply rounded-xl border border-border bg-card;
    box-shadow: 0 1px 2px -1px rgba(12,22,27,.06), 0 2px 6px -2px rgba(12,22,27,.05);
    transition: box-shadow 180ms ease, border-color 180ms ease;
  }
  .surface-card-interactive:hover {
    box-shadow: 0 4px 12px -3px rgba(12,22,27,.12), 0 2px 6px -2px rgba(12,22,27,.07);
    border-color: color-mix(in srgb, var(--border) 60%, var(--foreground));
  }
  .panel-title { @apply text-[15px] font-semibold tracking-tight text-foreground; }
  .panel-desc  { @apply text-xs text-muted-foreground; }
}
```

Variáveis de cor da marca Metta (troque pelas do projeto novo):

```css
:root {
  --background: #eef2f5;   /* tapete cinza-gelo */
  --foreground: #0c161b;   /* azul noite */
  --card: #ffffff;
  --primary: #ffbe18;             /* amarelo Metta */
  --primary-foreground: #0c161b;  /* fundo amarelo → texto azul noite */
  --muted: #eff3f5;
  --muted-foreground: #688594;
}
```

**Regra de contraste da marca:** fundo amarelo sempre com texto azul-noite, nunca
branco.

### Camada 2 — Primitivos

```bash
npx shadcn@latest add button card popover separator select table tabs \
  tooltip checkbox skeleton scroll-area toggle-group badge chart calendar
```

> Atenção: este projeto usa **Base UI** (`@base-ui/react`), onde o trigger de
> Popover/Select recebe `render={<button/>}`. No shadcn padrão (Radix) é `asChild`.
> É o único ponto que quebra ao portar. Detalhe em cada componente afetado.

### Camada 3 — Utilitários

`cn()` (clsx + tailwind-merge) e os formatadores pt-BR:

```ts
formatBRL(1234.5)   // "R$ 1.234,50"
formatPercent(0.1329) // "13,29%"
```

---

## Filtros

Todos os filtros gravam o estado na **URL** (`?from=…&funis=…`), não em estado
React. Isso os torna compatíveis com Server Components, sobrevive a refresh e
permite compartilhar link com o filtro aplicado. Quem lê e filtra é o servidor.

### `DateRangePopover` — filtro de período
`dashboard/date-range-popover.tsx` · 326 linhas · **o mais reusável do conjunto**

Presets à esquerda (7/14/30/90 dias, este mês, mês passado, este ano, ano passado),
calendário de 2 meses, Cancelar/Aplicar. No mobile vira 1 mês + dropdown "Seleção
rápida".

```tsx
<DateRangePopover from={from} to={to} />
```

| Prop | Tipo | Nota |
|---|---|---|
| `from` | `Date` | vem do parser de searchParams |
| `to` | `Date` | idem |

Escreve `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Deps: `react-day-picker`, `Calendar`,
`Popover`, `Separator`, `useIsMobile`.

**Armadilha de fuso (crítica):** `"2026-06-24"` é lido pelo JS como meia-noite UTC,
que em BRT vira o dia anterior — o filtro perde o último dia. O parser precisa
ancorar em `-03:00`:

```ts
const parseBrtDate = (s: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? `${s.trim()}T00:00:00-03:00` : s);
```

### `MultiSelectFilter` — multi-seleção com "Todos"
`dashboard/multi-select-filter.tsx` · 217 linhas

```tsx
<MultiSelectFilter
  param="tipos"
  label="Tipo"
  options={[{ value: "reels", label: "Reels" }, { value: "img", label: "Imagem" }]}
  mode="todos"
/>
```

| Prop | Tipo | Nota |
|---|---|---|
| `param` | `string` | nome do query param |
| `label` | `string` | rótulo do trigger |
| `options` | `{value,label}[]` | |
| `mode` | `"todos" \| "plain"` | `"todos"` adiciona a opção agregadora |

Serializa como `?param=a,b,c`. Vazio ou `"todos"` = sem corte.

### `FilterSelect` — versão simples
`dashboard/filter-select.tsx` · 26 linhas

Wrapper do MultiSelectFilter para lista de strings simples.

```tsx
<FilterSelect param="criterio" label="Ordenar por" options={["views", "er"]} />
```

### `Toolbar` — barra de filtros montada
`dashboard/toolbar.tsx` · 25 linhas

Junta chips de funil (esquerda) + extras + período (direita), com wrap no mobile.

```tsx
<Toolbar from={from} to={to} funil={false} extras={<FilterSelect … />} />
```

| Prop | Tipo | Default |
|---|---|---|
| `from`, `to` | `Date` | — |
| `funil` | `boolean` | `true` |
| `extras` | `ReactNode` | — |

### Toggles de dimensão
Botões de 2 estados que trocam a dimensão analisada, também via URL.

| Componente | Arquivo | Alterna |
|---|---|---|
| `SdrDataToggle` | `sdr-data-toggle.tsx` | data de agendamento ↔ data da reunião |
| `DistModoToggle` | `dist-modo-toggle.tsx` | Seguidores ↔ Vídeo |
| `FunilChips` | `funil-chips.tsx` | chips de funil (specific do domínio) |
| `ContaFilter` | `conta-filter.tsx` | conta de anúncio |

Os dois últimos têm opções cravadas no código; para outro projeto, generalize ou
use `FilterSelect`.

---

## KPIs e cards

### `KpiGrid` — grid de KPIs com delta
`dashboard/kpi-grid.tsx` · 69 linhas

```tsx
<KpiGrid kpis={[
  { label: "Faturamento", value: "R$ 280.000",
    hint: "no período", delta: { value: "+12%", direction: "up" } },
]} />
```

```ts
type Kpi = {
  label: string;
  value: string;                 // já formatado
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
};
```

| Prop | Tipo | Default |
|---|---|---|
| `kpis` | `Kpi[]` | — |
| `cols` | `string` | `"grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"` |
| `className` | `string` | — |

Delta colore sozinho: verde (up), vermelho (down), neutro (→). O componente **não
calcula** nada, recebe string pronta.

### `ProgressStatCard` — meta vs realizado
`dashboard/progress-card.tsx` · 118 linhas

Card com barra de progresso, comparando valor contra meta.

```tsx
<ProgressStatCard
  title="Faturamento" metaLabel="Meta do mês"
  value="R$ 280.000" metaValue="R$ 350.000"
  pct={0.8} footerLeft="80% da meta" warn={false}
/>
```

| Prop | Tipo | Nota |
|---|---|---|
| `pct` | `number` | 0 a 1 (clampado internamente) |
| `warn` | `boolean` | pinta de alerta quando atrasado |
| `footerLeft` | `string` | obrigatório |
| `title`, `value` | `string` | obrigatórios |
| `metaLabel`, `metaValue`, `sub`, `footerRight` | `string?` | |

### `PacingBars`
Mesmo arquivo. Barras de ritmo necessário para bater a meta.

---

## Gráficos

Todos em `dashboard/charts.tsx` (650 linhas), sobre **Recharts** + o wrapper
`ui/chart.tsx` do shadcn. Paleta automática por ordem das séries.

Tipo compartilhado:

```ts
type SeriesDef = {
  key: string;       // chave no objeto de dados
  label: string;     // legenda
  axis?: "left" | "right";  // escala dupla
  color?: string;    // override da paleta
  dashed?: boolean;  // tracejado (ex: linha de meta)
};

type ValueFormat = "number" | "percent" | "currency";
```

| Componente | Serve para | Props específicas |
|---|---|---|
| `ComboBarLineChart` | barras + linhas no mesmo eixo (ex: leads + taxa) | `bars`, `lines` |
| `MultiLineChart` | várias linhas comparadas | `lines`, `valueFormat` |
| `AreaLineChart` | área de base + linhas sobrepostas | `area`, `lines` |
| `GroupedBarChart` | barras agrupadas por categoria | `bars`, `valueFormat` |
| `DonutChart` | composição/participação | `data: {name,value}[]`, `centerLabel`, `centerValue` |
| `ProjectionChart` | realizado vs projetado vs meta, com marcador "hoje" | `realKey`, `projKey`, `metaValue`, `metaLabel`, `hojeLabel` |

Props comuns: `title` (obrigatório), `description?`, `data`, `xKey`, `height?`,
`className?`.

```tsx
<ComboBarLineChart
  title="Evolução diária" description="Leads e taxa de conversão"
  data={serie} xKey="dia"
  bars={[{ key: "leads", label: "Leads" }]}
  lines={[{ key: "taxa", label: "Conversão", axis: "right" }]}
/>

<ProjectionChart
  title="Pacing" data={serie} xKey="dia"
  realKey="realizado" projKey="projetado"
  metaValue={350000} metaLabel="Meta" hojeLabel="24/06"
/>
```

`ProjectionChart` é o mais específico e o mais difícil de recriar: vale portar em
vez de reescrever.

---

## Tabelas

### `MetricTable<T>` — tabela genérica com totais e ordenação
`dashboard/metric-table.tsx` · 230 linhas · **genérica, alto valor de reuso**

```tsx
<MetricTable
  title="Por campanha" sortable showTotal maxRows={20}
  rows={dados}
  columns={[
    { key: "nome", header: "Campanha", render: (r) => r.nome },
    { key: "gasto", header: "Gasto", align: "right",
      render: (r) => formatBRL(r.gasto), total: "sum" },
  ]}
/>
```

```ts
type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  total?: "sum" | "none" | ((rows: T[]) => React.ReactNode);
};
```

| Prop | Tipo | Nota |
|---|---|---|
| `columns` | `Column<T>[]` | |
| `rows` | `T[]` | |
| `sortable` | `boolean` | ordena clicando no header |
| `showTotal` | `boolean` | linha de total conforme `column.total` |
| `maxRows` | `number` | trunca com indicação |
| `footer` | `T` | linha de rodapé customizada |
| `empty` | `string` | mensagem de vazio |
| `title`, `description`, `toolbar` | | cabeçalho do painel |

A ordenação usa uma função `nodeText()` que extrai texto de dentro do
`ReactNode` renderizado — ordena certo mesmo quando a célula é JSX.

### `MetricTableInteractive`
`metric-table-interactive.tsx` · 200 linhas. Versão com célula expansível/clicável
(`InteractiveColumn`, `InteractiveCell`, `InteractiveRow`).

### `IgPostsTable` / `IgStoriesTable`
Tabelas com thumbnail + métricas de Instagram. Específicas do domínio: use como
**referência de padrão** (thumb 40px inline + link externo), não como genérico.

---

## Visualizações especializadas

### `FunnelVertical` — funil afunilando
`dashboard/funnel-vertical.tsx` · 88 linhas

Etapas em blocos que estreitam progressivamente (100% → 32% da largura), com
sombreamento decrescente.

```tsx
<FunnelVertical
  title="Funil comercial"
  steps={[
    { etapa: "Leads",    valor: 286, conversaoEtapa: 1 },
    { etapa: "Reuniões", valor: 23,  conversaoEtapa: 0.08 },
  ]}
  monetaryEtapas={["Investimento", "Faturamento"]}
/>
```

```ts
type FunnelStep = {
  etapa: string;
  valor: number;
  conversaoEtapa: number;  // 0..1, conversão da etapa anterior. Primeira = 1
};
```

A largura de cada barra é proporcional ao valor do topo, e entre as etapas aparece
um chip com a queda daquela passagem. `monetaryEtapas` (default
`["Investimento","Faturamento"]`) define quais etapas formatam como moeda.

### `SDRHeatmap` — mapa de calor dia × hora
`dashboard/sdr-heatmap.tsx` · 157 linhas

```tsx
<SDRHeatmap cells={cells} hourFrom={7} hourTo={20} orientation="hora-x" />
```

| Prop | Tipo | Default |
|---|---|---|
| `cells` | `SDRHeatmapCell[]` | — |
| `hourFrom` / `hourTo` | `number` | `7` / `20` |
| `orientation` | `"hora-x" \| "hora-y"` | `"hora-x"` |
| `title` | `string` | `"Heatmap de reuniões"` |

```ts
type SDRHeatmapCell = { diaSemana: number; hora: number; total: number };
```

`"hora-x"`: hora no topo, dia da semana na esquerda. `"hora-y"`: invertido, usado
quando são vários heatmaps lado a lado.

**Convenção:** `diaSemana` 0=Domingo … 6=Sábado. Intensidade em 5 faixas relativas
ao máximo (`bg-primary` a `bg-primary/15`), então não precisa de escala absoluta.

### `TimeInStage` — tempo médio por transição
`dashboard/time-in-stage.tsx` · 84 linhas. Mesmo visual afunilado, mostrando
duração média em cada passo.

```ts
type TimeInStagePoint = {
  label: string;
  mediaDias: number;
  medianaDias: number;
  n: number;        // amostra
};
```

Props: `points` (obrigatório), `title`, `description`, `className`.

---

## Layout e navegação

| Componente | Arquivo | Nota |
|---|---|---|
| `PageShell` | `page-shell.tsx` | wrapper de página (título + área de conteúdo) |
| `AppSidebar` | `app-sidebar.tsx` | sidebar `collapsible="icon"`, rail no desktop / sheet no mobile, estado em cookie, atalho Cmd/Ctrl+B |
| `NavMain`, `NavUser` | `nav-*.tsx` | itens de navegação e menu de usuário |
| `ThemeProvider`, `ThemeToggle` | `theme-*.tsx` | dark mode via `next-themes` |
| `InstagramPage` | `dashboard/instagram-page.tsx` | página inteira parametrizada por conta; contém também os fallbacks de Suspense (`KpisFallback`, `ChartFallback`, `GaleriaFallback`, `TableFallback`) |

Os fallbacks de skeleton do `instagram-page.tsx` são reusáveis fora dele e um bom
padrão para streaming com Suspense.

---

## Não reusáveis (específicos de auth/perfil)

`login-form`, `signup-form`, `recuperar-form`, `reset-confirm-form`,
`confirm-code-form`, `profile-form`, `change-password-form`, `email-change`,
`avatar-upload`, `delete-account-button`.

Acoplados ao NextAuth + Brevo deste projeto. Se o novo dashboard também precisar de
login, portar o **fluxo** vale mais que os componentes.

---

## Checklist de portabilidade

Ao levar um componente para outro projeto:

- [ ] Tokens CSS copiados (`surface-card`, `panel-title`, `panel-desc`, `:root`)
- [ ] Primitivos shadcn instalados
- [ ] `cn()` e formatadores disponíveis
- [ ] Popover/Select: `render=` (Base UI) vs `asChild` (Radix) conferido
- [ ] Filtros: o parser de searchParams no servidor existe, com fuso `-03:00`
- [ ] Gráficos: Recharts + `ui/chart.tsx` presentes

## Princípio de design mantido no conjunto

**Nenhum componente busca dado nem calcula métrica.** Todos recebem valores já
prontos (inclusive strings já formatadas) e só renderizam. O cálculo vive em
`src/lib/calc/*` como função pura, e a busca em `src/lib/sheets/*`.

É isso que torna o conjunto portável: um componente não sabe de onde o número veio.
