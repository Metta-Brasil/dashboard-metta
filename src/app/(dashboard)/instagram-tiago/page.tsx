import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { MultiLineChart } from "@/components/dashboard/charts";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { PageShell } from "@/components/page-shell";
import { formatInt } from "@/lib/calc/shared";
import type { IgPostRow } from "@/lib/calc/instagram";
import { getInstagramTiago } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "Instagram Tiago · Dashboard Metta",
};

export default function InstagramTiagoPage() {
  return (
    <PageShell
      title="Instagram Tiago"
      description="@tiago.alves.oliveira — perfil e posts"
    >
      <Suspense fallback={<KpisFallback />}>
        <IgKpis />
      </Suspense>

      <Suspense fallback={<ChartFallback />}>
        <IgHistorico />
      </Suspense>

      <Suspense fallback={<TableFallback rows={10} />}>
        <IgPosts />
      </Suspense>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

async function IgKpis() {
  const result = await getInstagramTiago();
  const { kpis } = result;

  const items: Kpi[] = [
    {
      label: "Seguidores",
      value: formatInt(kpis.seguidores),
      hint: "Snapshot mais recente",
    },
    {
      label: "Seguindo",
      value: formatInt(kpis.seguindo),
    },
    {
      label: "Posts",
      value: formatInt(kpis.posts),
    },
    {
      label: "Alcance 28d",
      value: formatInt(kpis.alcance28d),
      hint: "Alcance dos últimos 28 dias",
    },
  ];

  return (
    <KpiGrid
      kpis={items}
      cols="grid-cols-2 lg:grid-cols-4"
    />
  );
}

// ---------------------------------------------------------------------------
// Gráfico de linha — evolução de seguidores
// ---------------------------------------------------------------------------

async function IgHistorico() {
  const result = await getInstagramTiago();

  const data = result.historico.map((p) => ({
    data: p.data,
    seguidores: p.seguidores,
  }));

  return (
    <MultiLineChart
      title="Evolução de seguidores"
      description="Snapshot diário do perfil @tiago.alves.oliveira"
      data={data}
      xKey="data"
      lines={[{ key: "seguidores", label: "Seguidores" }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tabela de posts
// ---------------------------------------------------------------------------

function formatDateBr(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

const POST_COLUMNS: Column<IgPostRow>[] = [
  {
    key: "tipoLabel",
    header: "Tipo",
    render: (r) => r.tipoLabel,
    total: "none",
  },
  {
    key: "legenda",
    header: "Legenda",
    render: (r) => (
      <span className="block max-w-[320px] truncate" title={r.legenda}>
        {truncate(r.legenda, 80)}
      </span>
    ),
    total: "none",
  },
  {
    key: "data",
    header: "Data",
    render: (r) => formatDateBr(r.data as Date | null),
    total: "none",
  },
  {
    key: "views",
    header: "Views",
    align: "right",
    render: (r) => formatInt(r.views),
  },
  {
    key: "alcance",
    header: "Alcance",
    align: "right",
    render: (r) => formatInt(r.alcance),
  },
  {
    key: "curtidas",
    header: "Curtidas",
    align: "right",
    render: (r) => formatInt(r.curtidas),
  },
  {
    key: "taxaEngajamento",
    header: "Engaj.%",
    align: "right",
    render: (r) =>
      Number.isFinite(r.taxaEngajamento)
        ? `${r.taxaEngajamento.toFixed(2)}%`
        : "—",
    total: "none",
  },
  {
    key: "permalink",
    header: "Link",
    align: "center",
    render: (r) =>
      r.permalink ? (
        <Link
          href={r.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Ver
        </Link>
      ) : (
        "—"
      ),
    total: "none",
  },
];

async function IgPosts() {
  const result = await getInstagramTiago();

  return (
    <MetricTable
      title="Posts"
      description="Ordenado por data mais recente"
      columns={POST_COLUMNS}
      rows={result.allPosts}
      showTotal={false}
      empty="Nenhum post encontrado."
      maxRows={20}
    />
  );
}

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

function KpisFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
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
  );
}

function ChartFallback() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-[280px] w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

function TableFallback({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
