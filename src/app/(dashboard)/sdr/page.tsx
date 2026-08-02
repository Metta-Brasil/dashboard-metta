import { Suspense } from "react";

import { MultiLineChart } from "@/components/dashboard/charts";
import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { FilterSelect } from "@/components/dashboard/filter-select";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { SDRHeatmap } from "@/components/dashboard/sdr-heatmap";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
  safeRate,
  sumBy,
} from "@/lib/calc/shared";
import type { SDRPorDataRow, SDRRow } from "@/lib/calc/types";
import { getSdr, getFilters } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDayBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export default function SdrPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Comercial SDR"
      description="Performance individual dos SDRs, agendamentos e taxa de show."
      toolbar={
        <Suspense fallback={null}>
          <SdrToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<SdrSkeleton />}>
        <SdrContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function SdrToolbar({ searchParams }: PageProps) {
  const [filters, result] = await Promise.all([
    getFilters(searchParams),
    getSdr(searchParams),
  ]);
  return (
    <Toolbar
      from={filters.from}
      to={filters.to}
      funil
      extras={<FilterSelect param="sdr" label="SDR" options={result.sdrNames} />}
    />
  );
}

async function SdrContent({ searchParams }: PageProps) {
  const result = await getSdr(searchParams);
  const k = result.kpis;

  const kpis: Kpi[] = [
    {
      label: "Negócios criados",
      value: formatInt(k.negociosCriados),
      hint: "Criados no CRM (jul+)",
    },
    {
      label: "Agendamentos",
      value: formatInt(k.agendamentos),
      hint: "Total agendado no período",
    },
    {
      label: "Reuniões agendadas",
      value: formatInt(k.reunioesAgendadas),
      hint: "Janela por data da reunião",
    },
    {
      label: "Realizadas",
      value: formatInt(k.realizadas),
      hint: `Show ${formatPercent(k.taxaShow)}`,
    },
    {
      label: "Propostas",
      value: formatInt(k.propostas),
      hint: `Tx ${formatPercent(k.taxaProposta)} das realizadas`,
    },
    {
      label: "Valor propostas",
      value: formatBRLCompact(k.valorPropostas),
      hint: "Pipeline gerado",
    },
    {
      label: "Vendas",
      value: formatInt(k.vendas),
      hint: "Atribuídas ao funil SDR",
    },
    {
      label: "Faturamento",
      value: formatBRLCompact(k.faturamento),
      hint: "Receita das vendas atribuídas",
    },
    {
      label: "SAL",
      value: formatInt(k.sal),
      hint: "Negócios marcados como SAL",
    },
    {
      label: "SQL",
      value: formatInt(k.sql),
      hint: "Negócios marcados como SQL",
    },
  ];

  const columns: Column<SDRRow>[] = [
    { key: "sdr", header: "SDR", render: (r) => r.sdr, align: "left" },
    {
      key: "negociosCriados",
      header: "Negócios",
      render: (r) => formatInt(r.negociosCriados),
      align: "right",
    },
    {
      key: "taxaAgendamento",
      header: "Tx agend. %",
      render: (r) => formatPercent(r.taxaAgendamento),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.agendou),
            sumBy(rs, (r) => r.negociosCriados)
          )
        ),
    },
    {
      key: "agendou",
      header: "Agendou",
      render: (r) => formatInt(r.agendou),
      align: "right",
    },
    {
      key: "realizou",
      header: "Realizou",
      render: (r) => formatInt(r.realizou),
      align: "right",
    },
    {
      key: "show",
      header: "Show %",
      render: (r) => formatPercent(r.show),
      align: "right",
      total: () => formatPercent(k.taxaShow),
    },
    {
      key: "noShow",
      header: "No-show %",
      render: (r) => formatPercent(r.noShow),
      align: "right",
      total: () => formatPercent(1 - k.taxaShow),
    },
    {
      key: "propostas",
      header: "Propostas",
      render: (r) => formatInt(r.propostas),
      align: "right",
    },
    {
      key: "txProposta",
      header: "Tx prop. %",
      render: (r) => formatPercent(r.txProposta),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.propostas),
            sumBy(rs, (r) => r.realizou)
          )
        ),
    },
    {
      key: "valorProp",
      header: "Valor prop. (R$)",
      render: (r) => formatBRL(r.valorProp),
      align: "right",
    },
    {
      key: "vendas",
      header: "Vendas",
      render: (r) => formatInt(r.vendas),
      align: "right",
    },
    {
      key: "close",
      header: "Close %",
      render: (r) => formatPercent(r.close),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.vendas),
            sumBy(rs, (r) => r.propostas)
          )
        ),
    },
  ];

  const porDataColumns: Column<SDRPorDataRow>[] = [
    {
      key: "dia",
      header: "Data",
      render: (r) => formatDayBr(r.dia),
      align: "left",
    },
    {
      key: "negociosCriados",
      header: "Negócios",
      render: (r) => formatInt(r.negociosCriados),
      align: "right",
    },
    {
      key: "taxaAgendamento",
      header: "Tx agend. %",
      render: (r) => formatPercent(r.taxaAgendamento),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.agendou),
            sumBy(rs, (r) => r.negociosCriados)
          )
        ),
    },
    {
      key: "agendou",
      header: "Agendou",
      render: (r) => formatInt(r.agendou),
      align: "right",
    },
    {
      key: "realizou",
      header: "Realizou",
      render: (r) => formatInt(r.realizou),
      align: "right",
    },
    {
      key: "show",
      header: "Show %",
      render: (r) => formatPercent(r.show),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.realizou),
            sumBy(rs, (r) => r.agendou)
          )
        ),
    },
    {
      key: "noShow",
      header: "No-show %",
      render: (r) => formatPercent(r.noShow),
      align: "right",
      total: (rs) => {
        const ag = sumBy(rs, (r) => r.agendou);
        const re = sumBy(rs, (r) => r.realizou);
        return formatPercent(ag > 0 ? 1 - re / ag : 0);
      },
    },
    {
      key: "propostas",
      header: "Propostas",
      render: (r) => formatInt(r.propostas),
      align: "right",
    },
    {
      key: "txProposta",
      header: "Tx prop. %",
      render: (r) => formatPercent(r.txProposta),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.propostas),
            sumBy(rs, (r) => r.realizou)
          )
        ),
    },
    {
      key: "valorProp",
      header: "Valor prop. (R$)",
      render: (r) => formatBRL(r.valorProp),
      align: "right",
    },
    {
      key: "vendas",
      header: "Vendas",
      render: (r) => formatInt(r.vendas),
      align: "right",
    },
    {
      key: "close",
      header: "Close %",
      render: (r) => formatPercent(r.close),
      align: "right",
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.vendas),
            sumBy(rs, (r) => r.realizou)
          )
        ),
    },
  ];

  return (
    <>
      <KpiGrid kpis={kpis} />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="flex lg:col-span-1">
          <FunnelVertical
            title="Funil SDR"
            steps={result.funilSdr}
            monetaryEtapas={[]}
            className="h-full w-full"
          />
        </div>
        <div className="flex lg:col-span-2">
          <MultiLineChart
            title="Reuniões por dia"
            description="Reuniões agendadas vs realizadas por data da reunião"
            data={result.serieReunioesDia.map((r) => ({
              dia: formatDayBr(r.dia),
              agendadas: r.agendadas,
              realizadas: r.realizadas,
            }))}
            xKey="dia"
            lines={[
              { key: "agendadas", label: "Reuniões agendadas" },
              { key: "realizadas", label: "Reuniões realizadas" },
            ]}
            height={320}
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SDRHeatmap
          cells={result.heatmapAgendadas}
          orientation="hora-y"
          title="Reuniões agendadas"
        />
        <SDRHeatmap
          cells={result.heatmapRealizadas}
          orientation="hora-y"
          title="Reuniões realizadas"
        />
        <SDRHeatmap
          cells={result.heatmapPropostas}
          orientation="hora-y"
          title="Propostas"
        />
        <SDRHeatmap
          cells={result.heatmapVendas}
          orientation="hora-y"
          title="Vendas"
        />
      </div>

      <MetricTable
        title="Performance por SDR"
        description="Ordenado por negócios criados (desc)"
        columns={columns}
        rows={result.porSdr}
      />

      <MetricTable
        title="Performance por data"
        description="Métricas diárias por data da reunião."
        columns={porDataColumns}
        rows={result.porData}
      />
    </>
  );
}

function SdrSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[110px] flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-7 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
