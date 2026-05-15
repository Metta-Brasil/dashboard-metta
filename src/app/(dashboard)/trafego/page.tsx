import { Suspense } from "react";

import {
  ComboBarLineChart,
  GroupedBarChart,
} from "@/components/dashboard/charts";
import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
} from "@/lib/calc/shared";
import type {
  Funil,
  TrafegoFunilResumo,
  TrafegoRankingRow,
} from "@/lib/calc/types";
import { getFilters, getTrafego } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FUNIL_LABEL: Record<Funil, string> = {
  todos: "Todos",
  sala: "Sala",
  aplica: "Aplicação",
  sessao: "Sessão",
  isca: "Isca",
  reality: "Reality",
};

function formatDayBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function formatMoneyOrDash(n: number | null): string {
  return n == null ? "—" : formatBRL(n);
}

function formatPctOrDash(n: number | null): string {
  return n == null ? "—" : formatPercent(n);
}

export default function TrafegoPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Tráfego Pago"
      description="Investimento, MQL, custo por funil e ranking de campanhas Meta."
      toolbar={
        <Suspense fallback={null}>
          <TrafegoToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<KpisFallback />}>
        <TrafegoKpis searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={6} />}>
        <EvolucaoDiaria searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={5} />}>
        <MqlPorFunil searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<FunilFallback />}>
        <FunilTrafego searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={6} />}>
        <RankingMidia searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

async function TrafegoToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

async function TrafegoKpis({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);
  const k = result.kpis;

  const kpis: Kpi[] = [
    {
      label: "Investimento",
      value: formatBRLCompact(k.investimento),
      hint: "Gasto Meta no período",
    },
    {
      label: "Impressões",
      value: formatInt(k.impressoes),
      hint: `CPM ${formatBRL(k.cpm)}`,
    },
    {
      label: "Cliques",
      value: formatInt(k.cliques),
      hint: `CTR ${formatPercent(k.ctr)} · CPC ${formatBRL(k.cpc)}`,
    },
    {
      label: "Leads",
      value: formatInt(k.leads),
      hint: `CPL ${formatBRL(k.cpl)} · LP→Lead ${formatPercent(k.txLpLead)}`,
    },
    {
      label: "MQL",
      value: formatInt(k.mql),
      hint: `CMQL ${formatBRL(k.cmql)}`,
    },
  ];

  return <KpiGrid kpis={kpis} />;
}

// ---------------------------------------------------------------------------
// Evolução diária — Investimento, MQL, CMQL (+ Cliques, Leads)
// ---------------------------------------------------------------------------

async function EvolucaoDiaria({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  const data = result.serieCombo.map((r) => ({
    dia: formatDayBr(r.dia),
    investimento: Math.round(r.investimento),
    mql: r.mql,
    cmql: r.cmql == null ? null : Math.round(r.cmql),
  }));

  return (
    <ComboBarLineChart
      title="Investimento, MQL e CMQL · diário"
      description="Barras (Investimento + MQL) + linha (CMQL, eixo direito)"
      data={data}
      xKey="dia"
      bars={[
        { key: "investimento", label: "Investimento" },
        { key: "mql", label: "MQL" },
      ]}
      lines={[{ key: "cmql", label: "CMQL", axis: "right" }]}
    />
  );
}

// ---------------------------------------------------------------------------
// MQL & CMQL por funil
// ---------------------------------------------------------------------------

async function MqlPorFunil({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  const data = result.mqlCmqlPorFunil.map((r) => ({
    funil: FUNIL_LABEL[r.funil] ?? r.funil,
    mql: r.mql,
    cmql: r.cmql == null ? 0 : Math.round(r.cmql),
  }));

  return (
    <GroupedBarChart
      title="MQL e CMQL por funil"
      description="Recorte fixo dos 5 funis (ignora filtro de funil)"
      data={data}
      xKey="funil"
      bars={[
        { key: "mql", label: "MQL" },
        { key: "cmql", label: "CMQL", axis: "right" },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Funil de tráfego + resumo
// ---------------------------------------------------------------------------

async function FunilTrafego({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  return (
    <div className="flex flex-col gap-3">
      <FunnelVertical
        title="Funil de tráfego"
        steps={result.funilTrafego}
        monetaryEtapas={["Investimento"]}
      />
      <FunilResumo resumo={result.funilTrafegoResumo} />
    </div>
  );
}

function FunilResumo({ resumo }: { resumo: TrafegoFunilResumo }) {
  const items: { label: string; value: string }[] = [
    { label: "CPM", value: formatMoneyOrDash(resumo.cpm) },
    { label: "CPC", value: formatMoneyOrDash(resumo.cpc) },
    { label: "CTR", value: formatPctOrDash(resumo.ctr) },
    { label: "CPL", value: formatMoneyOrDash(resumo.cpl) },
    { label: "CMQL", value: formatMoneyOrDash(resumo.cmql) },
    { label: "Tx LP→Lead", value: formatPctOrDash(resumo.txLpLead) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-xs"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {it.label}
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking de mídia
// ---------------------------------------------------------------------------

async function RankingMidia({ searchParams }: PageProps) {
  const [result, filters] = await Promise.all([
    getTrafego(searchParams),
    getFilters(searchParams),
  ]);

  const agrupamento =
    result.ranking[0]?.agrupamento ?? filters.rankingBy ?? "campanha";
  const agrupLabel = agrupamento === "adset" ? "Conjunto" : "Campanha";

  const columns: Column<TrafegoRankingRow>[] = [
    {
      key: "nome",
      header: agrupLabel,
      render: (r) => (
        <span className="block max-w-[280px] truncate" title={r.nome}>
          {r.nome}
        </span>
      ),
    },
    {
      key: "investimento",
      header: "Invest",
      align: "right",
      render: (r) => formatBRL(r.investimento),
    },
    {
      key: "impressoes",
      header: "Impr",
      align: "right",
      render: (r) => formatInt(r.impressoes),
    },
    {
      key: "ctr",
      header: "CTR",
      align: "right",
      render: (r) => formatPercent(r.ctr),
    },
    {
      key: "cpc",
      header: "CPC",
      align: "right",
      render: (r) => formatBRL(r.cpc),
    },
    {
      key: "cpm",
      header: "CPM",
      align: "right",
      render: (r) => formatBRL(r.cpm),
    },
    {
      key: "lpViews",
      header: "LP Views",
      align: "right",
      render: (r) => formatInt(r.lpViews),
    },
    {
      key: "leads",
      header: "Leads",
      align: "right",
      render: (r) => formatInt(r.leads),
    },
    {
      key: "cpl",
      header: "CPL",
      align: "right",
      render: (r) => formatBRL(r.cpl),
    },
    {
      key: "mql",
      header: "MQL",
      align: "right",
      render: (r) => formatInt(r.mql),
    },
    {
      key: "cmql",
      header: "CMQL",
      align: "right",
      render: (r) => (Number.isFinite(r.cmql) ? formatBRL(r.cmql) : "—"),
    },
  ];

  return (
    <MetricTable
      title="Ranking de mídia"
      description={`Agrupado por ${agrupLabel.toLowerCase()} · ordenado por CMQL.`}
      columns={columns}
      rows={result.ranking}
      empty="Sem campanhas no período."
    />
  );
}

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

function KpisFallback() {
  return (
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

function FunilFallback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[70px] flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
