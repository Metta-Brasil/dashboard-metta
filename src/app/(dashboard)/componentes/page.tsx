import { Suspense } from "react";

import {
  AreaLineChart,
  ComboBarLineChart,
  DonutChart,
  GroupedBarChart,
  MultiLineChart,
  ProjectionChart,
} from "@/components/dashboard/charts";
import { DateRangePopover } from "@/components/dashboard/date-range-popover";
import { FilterSelect } from "@/components/dashboard/filter-select";
import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import { PacingBars, ProgressStatCard } from "@/components/dashboard/progress-card";
import { SDRHeatmap } from "@/components/dashboard/sdr-heatmap";
import { TimeInStage } from "@/components/dashboard/time-in-stage";
import { EmptyState, KpiCard, PageShell } from "@/components/page-shell";
import { formatBRL, formatInt, formatPercent } from "@/lib/calc/shared";

/**
 * Vitrine de componentes — renderiza cada componente do dashboard com dados
 * fictícios, para inspeção visual e refinamento individual.
 *
 * Não consome Sheets nem cache: todos os dados aqui são literais. Serve como
 * referência viva do catálogo em docs/COMPONENTS.md.
 */

// ----- Dados fictícios ------------------------------------------------------

const SERIE = [
  { dia: "01/06", leads: 10, mql: 5, taxa: 0.5, gasto: 561 },
  { dia: "02/06", leads: 9, mql: 8, taxa: 0.89, gasto: 550 },
  { dia: "03/06", leads: 29, mql: 20, taxa: 0.69, gasto: 1872 },
  { dia: "04/06", leads: 43, mql: 33, taxa: 0.77, gasto: 1883 },
  { dia: "05/06", leads: 11, mql: 9, taxa: 0.82, gasto: 1528 },
  { dia: "06/06", leads: 23, mql: 13, taxa: 0.57, gasto: 1507 },
  { dia: "07/06", leads: 26, mql: 15, taxa: 0.58, gasto: 1939 },
];

const PROJECAO = SERIE.map((r, i) => ({
  dia: r.dia,
  realizado: i <= 4 ? (i + 1) * 42000 : null,
  projetado: (i + 1) * 40000,
}));

const HEATMAP = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 14 }, (_, h) => ({
    diaSemana: d,
    hora: h + 7,
    total: d === 0 || d === 6 ? 0 : Math.max(0, ((d * 7 + h) % 9) - 2),
  }))
).flat();

type LinhaTabela = { campanha: string; gasto: number; leads: number; cpl: number };

const TABELA: LinhaTabela[] = [
  { campanha: "PERP | SESSAO | FRIO", gasto: 15384.64, leads: 189, cpl: 81.4 },
  { campanha: "PERP | APLICACAO | QUENTE", gasto: 13535.8, leads: 97, cpl: 139.54 },
  { campanha: "PERP | SALA | CETV", gasto: 4210.1, leads: 62, cpl: 67.9 },
];

const COLUNAS: Column<LinhaTabela>[] = [
  { key: "campanha", header: "Campanha", render: (r) => r.campanha },
  {
    key: "gasto",
    header: "Investimento",
    align: "right",
    render: (r) => formatBRL(r.gasto),
    total: "sum",
  },
  {
    key: "leads",
    header: "Leads",
    align: "right",
    render: (r) => formatInt(r.leads),
    total: "sum",
  },
  {
    key: "cpl",
    header: "CPL",
    align: "right",
    render: (r) => formatBRL(r.cpl),
    total: (rows) => {
      const g = rows.reduce((s, r) => s + r.gasto, 0);
      const l = rows.reduce((s, r) => s + r.leads, 0);
      return formatBRL(l ? g / l : 0);
    },
  },
];

const KPIS: Kpi[] = [
  { label: "Investimento", value: formatBRL(29199.39), hint: "no período" },
  {
    label: "MQL",
    value: formatInt(286),
    delta: { value: "+26%", direction: "up" },
  },
  {
    label: "CMQL",
    value: formatBRL(102.1),
    delta: { value: "-40%", direction: "down" },
  },
  {
    label: "Reuniões",
    value: formatInt(23),
    delta: { value: "0%", direction: "neutral" },
  },
  { label: "Conversão", value: formatPercent(0.1329), hint: "MQL → reunião" },
];

// ----- Wrapper de inspeção -------------------------------------------------

function Spec({
  name,
  file,
  note,
  children,
}: {
  name: string;
  file: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {name}
        </h3>
        <code className="font-mono text-[11px] text-muted-foreground">{file}</code>
        {note && (
          <span className="text-xs text-muted-foreground">{note}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ----- Página ---------------------------------------------------------------

export const metadata = { title: "Componentes" };

export default function ComponentesPage() {
  // Datas fixas: `new Date()` em Server Component quebra o prerender no
  // Next 16, e uma vitrine determinística é preferível de todo modo.
  const from = new Date("2026-06-01T00:00:00-03:00");
  const to = new Date("2026-06-30T00:00:00-03:00");

  return (
    <PageShell title="Componentes">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Vitrine com dados fictícios. Cada bloco mostra o componente renderizado e
        o caminho do arquivo. Documentação de props em{" "}
        <code className="font-mono text-xs">docs/COMPONENTS.md</code>.
      </p>

      <Group title="Filtros">
        <Spec
          name="Toolbar (composto)"
          file="dashboard/toolbar.tsx"
          note="chips de funil + extras + período"
        >
          <Suspense fallback={<div className="h-9" />}>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                param="demo_criterio"
                label="Ordenar por"
                options={["Views", "Engajamento", "Alcance"]}
              />
              <MultiSelectFilter
                param="demo_tipos"
                label="Tipo"
                mode="todos"
                options={[
                  { value: "reels", label: "Reels" },
                  { value: "carrossel", label: "Carrossel" },
                  { value: "imagem", label: "Imagem" },
                ]}
              />
              <DateRangePopover from={from} to={to} />
            </div>
          </Suspense>
        </Spec>
      </Group>

      <Group title="KPIs e cards">
        <Spec name="KpiGrid" file="dashboard/kpi-grid.tsx" note="delta colorido automático">
          <KpiGrid kpis={KPIS} />
        </Spec>

        <Spec name="KpiCard" file="page-shell.tsx" note="card unitário, sem delta">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Seguidores" value="12.480" hint="+320 no mês" />
            <KpiCard label="Alcance 28d" value="184.200" />
            <KpiCard label="Sem dado" />
          </div>
        </Spec>

        <Spec name="ProgressStatCard" file="dashboard/progress-card.tsx" note="meta vs realizado">
          <div className="grid gap-3 lg:grid-cols-2">
            <ProgressStatCard
              title="Faturamento"
              metaLabel="Meta do mês"
              value={formatBRL(280000)}
              metaValue={formatBRL(350000)}
              pct={0.8}
              footerLeft="80% da meta"
              footerRight="6 dias restantes"
            />
            <ProgressStatCard
              title="Vendas"
              metaLabel="Meta do mês"
              value="4"
              metaValue="10"
              pct={0.4}
              warn
              footerLeft="Ritmo abaixo do necessário"
              footerRight="warn ativo"
            />
          </div>
        </Spec>

        <Spec name="PacingBars" file="dashboard/progress-card.tsx" note="já inclui o card">
          <PacingBars
            title="Ritmo necessário"
            description="Para bater a meta até o fim do mês"
            rows={[
              { label: "Realizado", value: formatBRL(280000), pct: 0.8 },
              { label: "Necessário/dia", value: formatBRL(11666), pct: 0.35 },
            ]}
          />
        </Spec>

        <Spec name="EmptyState" file="page-shell.tsx">
          <EmptyState />
        </Spec>
      </Group>

      <Group title="Gráficos">
        <Spec
          name="ComboBarLineChart"
          file="dashboard/charts.tsx"
          note="barras + linha em eixo duplo"
        >
          <ComboBarLineChart
            title="Evolução diária"
            description="Leads e taxa de conversão"
            data={SERIE}
            xKey="dia"
            bars={[{ key: "leads", label: "Leads" }]}
            lines={[{ key: "taxa", label: "Conversão", axis: "right" }]}
          />
        </Spec>

        <div className="grid gap-6 lg:grid-cols-2">
          <Spec name="MultiLineChart" file="dashboard/charts.tsx">
            <MultiLineChart
              title="Leads x MQL"
              data={SERIE}
              xKey="dia"
              lines={[
                { key: "leads", label: "Leads" },
                { key: "mql", label: "MQL" },
              ]}
            />
          </Spec>

          <Spec name="AreaLineChart" file="dashboard/charts.tsx">
            <AreaLineChart
              title="Investimento e leads"
              data={SERIE}
              xKey="dia"
              area={{ key: "gasto", label: "Investimento" }}
              lines={[{ key: "leads", label: "Leads", axis: "right" }]}
            />
          </Spec>

          <Spec name="GroupedBarChart" file="dashboard/charts.tsx">
            <GroupedBarChart
              title="Por dia"
              data={SERIE}
              xKey="dia"
              bars={[
                { key: "leads", label: "Leads" },
                { key: "mql", label: "MQL" },
              ]}
            />
          </Spec>

          <Spec name="DonutChart" file="dashboard/charts.tsx" note="com centro customizado">
            <DonutChart
              title="Distribuição por funil"
              data={[
                { name: "Sessão", value: 189 },
                { name: "Aplicação", value: 97 },
                { name: "Sala", value: 62 },
              ]}
              centerLabel="Total"
              centerValue="348"
            />
          </Spec>
        </div>

        <Spec
          name="ProjectionChart"
          file="dashboard/charts.tsx"
          note="realizado x projetado x meta, com marcador de hoje"
        >
          <ProjectionChart
            title="Pacing de faturamento"
            data={PROJECAO}
            xKey="dia"
            realKey="realizado"
            projKey="projetado"
            metaValue={350000}
            metaLabel="Meta"
            hojeLabel="05/06"
          />
        </Spec>
      </Group>

      <Group title="Tabelas">
        <Spec
          name="MetricTable"
          file="dashboard/metric-table.tsx"
          note="genérica: ordenável, com linha de total"
        >
          <MetricTable
            title="Por campanha"
            description="Clique no cabeçalho para ordenar"
            columns={COLUNAS}
            rows={TABELA}
            sortable
            showTotal
          />
        </Spec>

        <Spec name="MetricTable (vazia)" file="dashboard/metric-table.tsx">
          <MetricTable
            title="Sem resultados"
            columns={COLUNAS}
            rows={[]}
            empty="Nenhuma campanha no período."
          />
        </Spec>
      </Group>

      <Group title="Visualizações">
        <div className="grid gap-6 lg:grid-cols-2">
          <Spec name="FunnelVertical" file="dashboard/funnel-vertical.tsx">
            <FunnelVertical
              title="Funil comercial"
              description="Junho"
              steps={[
                { etapa: "Leads", valor: 376, conversaoEtapa: 1 },
                { etapa: "MQL", valor: 286, conversaoEtapa: 0.76 },
                { etapa: "Reuniões agendadas", valor: 39, conversaoEtapa: 0.14 },
                { etapa: "Reuniões realizadas", valor: 23, conversaoEtapa: 0.59 },
                { etapa: "Vendas", valor: 4, conversaoEtapa: 0.17 },
              ]}
            />
          </Spec>

          <Spec name="TimeInStage" file="dashboard/time-in-stage.tsx">
            <TimeInStage
              points={[
                { label: "Lead → MQL", mediaDias: 0.4, medianaDias: 0.2, n: 286 },
                { label: "MQL → Agendamento", mediaDias: 2.1, medianaDias: 1, n: 39 },
                { label: "Agendamento → Reunião", mediaDias: 4.8, medianaDias: 4, n: 23 },
              ]}
            />
          </Spec>
        </div>

        <Spec
          name="SDRHeatmap (hora-x)"
          file="dashboard/sdr-heatmap.tsx"
          note="hora no topo, dia na esquerda"
        >
          <SDRHeatmap cells={HEATMAP} title="Reuniões por dia e hora" />
        </Spec>

        <Spec name="SDRHeatmap (hora-y)" file="dashboard/sdr-heatmap.tsx" note="eixos invertidos">
          <SDRHeatmap cells={HEATMAP} orientation="hora-y" title="Mesmo dado, invertido" />
        </Spec>
      </Group>
    </PageShell>
  );
}
