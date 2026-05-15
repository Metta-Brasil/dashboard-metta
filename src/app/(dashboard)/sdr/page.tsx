import { Suspense } from "react";

import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { SDRHeatmap } from "@/components/dashboard/sdr-heatmap";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import { calcSdr } from "@/lib/calc/sdr";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
} from "@/lib/calc/shared";
import type { SDRRow } from "@/lib/calc/types";
import { parseFilters } from "@/lib/filters";
import { readAllSheets } from "@/lib/sheets/read";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const params = await searchParams;
  const filters = parseFilters(params);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

async function SdrContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const data = await readAllSheets(["leads", "sdr", "vendas"]);
  const result = calcSdr(data, filters);
  const k = result.kpis;

  const kpis: Kpi[] = [
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
  ];

  const columns: Column<SDRRow>[] = [
    {
      key: "sdr",
      header: "SDR",
      render: (r) => r.sdr,
      align: "left",
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
    },
  ];

  return (
    <>
      <KpiGrid kpis={kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FunnelVertical
          title="Funil SDR"
          steps={result.funilSdr}
          monetaryEtapas={[]}
        />
        <SDRHeatmap cells={result.heatmap} hourFrom={7} hourTo={20} />
      </div>

      <MetricTable
        title="Performance por SDR"
        description="Ordenado por agendamentos (desc)"
        columns={columns}
        rows={result.porSdr}
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
