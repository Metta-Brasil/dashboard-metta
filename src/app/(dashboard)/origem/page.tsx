import { Suspense } from "react";

import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import { calcOrigem } from "@/lib/calc/origem";
import { formatBRLCompact, formatInt } from "@/lib/calc/shared";
import type { OrigemRow } from "@/lib/calc/types";
import { parseFilters } from "@/lib/filters";
import { readAllSheets } from "@/lib/sheets/read";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function OrigemPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Origem"
      description="Distribuição do funil por UTM, qualificação, cargo, faturamento e segmento."
      toolbar={
        <Suspense fallback={null}>
          <OrigemToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<OrigemSkeleton />}>
        <OrigemContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function OrigemToolbar({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

async function OrigemContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const data = await readAllSheets(["leads", "sdr", "vendas"]);
  const result = calcOrigem(data, filters);

  const baseColumns: Column<OrigemRow>[] = [
    {
      key: "dimensao",
      header: "Dimensão",
      render: (r) => r.dimensao,
      align: "left",
    },
    {
      key: "leadsQualif",
      header: "Leads qualif",
      render: (r) => formatInt(r.leadsQualif),
      align: "right",
    },
    {
      key: "mql",
      header: "MQL",
      render: (r) => formatInt(r.mql),
      align: "right",
    },
    {
      key: "agendamentos",
      header: "Agendamentos",
      render: (r) => formatInt(r.agendamentos),
      align: "right",
    },
    {
      key: "reunioesAgendadas",
      header: "Reuniões agendadas",
      render: (r) => formatInt(r.reunioesAgendadas),
      align: "right",
    },
    {
      key: "reunioesRealizadas",
      header: "Reuniões realizadas",
      render: (r) => formatInt(r.reunioesRealizadas),
      align: "right",
    },
    {
      key: "vendas",
      header: "Vendas",
      render: (r) => formatInt(r.vendas),
      align: "right",
    },
    {
      key: "faturamento",
      header: "Faturamento",
      render: (r) => formatBRLCompact(r.faturamento),
      align: "right",
    },
  ];

  const faturamentoColumns: Column<OrigemRow>[] = [
    baseColumns[0],
    {
      key: "qualif",
      header: "Qualif.",
      render: (r) => r.qualif ?? "—",
      align: "left",
    },
    ...baseColumns.slice(1),
  ];

  return (
    <div className="flex flex-col gap-4">
      <MetricTable
        title="Por UTM Source"
        columns={baseColumns}
        rows={result.porUtmSource}
      />
      <MetricTable
        title="Por UTM Medium"
        columns={baseColumns}
        rows={result.porUtmMedium}
      />
      <MetricTable
        title="Por UTM Campaign"
        columns={baseColumns}
        rows={result.porUtmCampaign}
      />
      <MetricTable
        title="Por Qualificação"
        columns={baseColumns}
        rows={result.porQualificacao}
      />
      <MetricTable
        title="Por Cargo"
        columns={baseColumns}
        rows={result.porCargo}
      />
      <MetricTable
        title="Por Faixa de Faturamento"
        columns={faturamentoColumns}
        rows={result.porFaturamento}
      />
      <MetricTable
        title="Por Segmento de Mercado"
        columns={baseColumns}
        rows={result.porSegmento}
      />
    </div>
  );
}

function OrigemSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
