import { Suspense } from "react";

import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import { formatBRLCompact, formatInt } from "@/lib/calc/shared";
import type { OrigemRow } from "@/lib/calc/types";
import { getOrigem, getFilters } from "@/lib/page-data";

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
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

async function OrigemContent({ searchParams }: PageProps) {
  const result = await getOrigem(searchParams);

  // Cabeçalhos abreviados conforme wireframe #p8; o 1º cabeçalho varia
  // por tabela (Origem / Campanha / Qualificação / Cargo / etc.).
  const metricCols: Column<OrigemRow>[] = [
    {
      key: "leadsQualif",
      header: "Leads qualif.",
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
      header: "Agend.",
      render: (r) => formatInt(r.agendamentos),
      align: "right",
    },
    {
      key: "reunioesAgendadas",
      header: "Reun. ag.",
      render: (r) => formatInt(r.reunioesAgendadas),
      align: "right",
    },
    {
      key: "reunioesRealizadas",
      header: "Reun. real.",
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

  const cols = (firstHeader: string): Column<OrigemRow>[] => [
    {
      key: "dimensao",
      header: firstHeader,
      render: (r) => r.dimensao,
      align: "left",
    },
    ...metricCols,
  ];

  const faturamentoColumns: Column<OrigemRow>[] = [
    {
      key: "dimensao",
      header: "Faturamento",
      render: (r) => r.dimensao,
      align: "left",
    },
    {
      key: "qualif",
      header: "Qualif.",
      render: (r) => r.qualif ?? "—",
      align: "left",
    },
    ...metricCols,
  ];

  return (
    <div className="flex flex-col gap-4">
      <MetricTable
        title="Por UTM Source"
        columns={cols("Origem")}
        rows={result.porUtmSource}
      />
      <MetricTable
        title="Por UTM Medium"
        columns={cols("Origem")}
        rows={result.porUtmMedium}
      />
      <MetricTable
        title="Por UTM Campaign"
        columns={cols("Campanha")}
        rows={result.porUtmCampaign}
      />
      <MetricTable
        title="Por UTM Content"
        columns={cols("Conteúdo")}
        rows={result.porUtmContent}
      />
      <MetricTable
        title="Por Qualificação"
        columns={cols("Qualificação")}
        rows={result.porQualificacao}
      />
      <MetricTable
        title="Por Cargo"
        columns={cols("Cargo")}
        rows={result.porCargo}
      />
      <MetricTable
        title="Por Faixa de Faturamento"
        columns={faturamentoColumns}
        rows={result.porFaturamento}
      />
      <MetricTable
        title="Por Segmento de Mercado"
        columns={cols("Segmento")}
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
