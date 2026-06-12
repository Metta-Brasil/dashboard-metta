import { Suspense } from "react";

import {
  ComboBarLineChart,
  DonutChart,
  GroupedBarChart,
  MultiLineChart,
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
  safeRate,
  sumBy,
} from "@/lib/calc/shared";
import type { Funil, TrafegoRankingRow } from "@/lib/calc/types";
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


export default function TrafegoPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="TP Aquisição"
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

      {/* Desenho do usuário: larguras assimétricas (3 colunas).
          Linha 1: combo (largo, 2/3) | Funil de tráfego (estreito, 1/3).
          Linha 2: MQL por temperatura (estreito, 1/3) | MQL e CMQL por
          funil (largo, 2/3). */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <Suspense fallback={<TableFallback rows={6} />}>
          <div className="flex flex-col lg:col-span-2">
            <EvolucaoDiaria searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<FunilFallback />}>
          <div className="flex flex-col lg:col-span-1">
            <FunilTrafego searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<TableFallback rows={5} />}>
          <div className="flex flex-col lg:col-span-1">
            <MqlPorTemperatura searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<TableFallback rows={5} />}>
          <div className="flex flex-col lg:col-span-2">
            <MqlPorFunil searchParams={searchParams} />
          </div>
        </Suspense>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="flex flex-col">
          <Suspense fallback={<ChartCardFallback />}>
            <ConversoesTrafego searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="flex flex-col">
          <Suspense fallback={<ChartCardFallback />}>
            <CustosTrafego searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

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
      label: "CPM",
      value: formatBRL(k.cpm),
      hint: "Custo por mil impressões",
    },
    {
      label: "CPC",
      value: formatBRL(k.cpc),
      hint: "Custo por clique",
    },
    {
      label: "CTR",
      value: formatPercent(k.ctr),
      hint: "Cliques ÷ impressões",
    },
    {
      label: "CMQL",
      value: formatBRL(k.cmql),
      hint: "Investimento ÷ MQL",
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
      className="h-full"
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
      className="h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// MQL por temperatura (donut) — Advantage / Quente / Frio via utm_source
// ---------------------------------------------------------------------------

async function MqlPorTemperatura({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  const data = result.mqlPorTemperatura.map((r) => ({
    name: r.temperatura,
    value: r.mql,
  }));
  const totalMql = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <DonutChart
      title="MQL por temperatura"
      description="Distribuição de MQL por temperatura (utm_source)"
      data={data}
      centerValue={formatInt(totalMql)}
      centerLabel="MQL"
      className="h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Conversões — taxas do funil de tráfego (%)
// ---------------------------------------------------------------------------

async function ConversoesTrafego({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  const data = result.serieConversoesDia.map((r) => ({
    dia: formatDayBr(r.dia),
    ctr: r.ctr,
    conexaoLp: r.conexaoLp,
    conversaoLp: r.conversaoLp,
    conversaoCliques: r.conversaoCliques,
  }));

  return (
    <MultiLineChart
      title="Conversões"
      description="Taxas do funil de tráfego · diário"
      data={data}
      xKey="dia"
      lines={[
        { key: "ctr", label: "CTR" },
        { key: "conexaoLp", label: "Conexão LP" },
        { key: "conversaoLp", label: "Conversão LP" },
        { key: "conversaoCliques", label: "Conversão cliques" },
      ]}
      valueFormat="percent"
      className="h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Custos — custo por etapa (R$)
// ---------------------------------------------------------------------------

async function CustosTrafego({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  const data = result.serieCustosDia.map((r) => ({
    dia: formatDayBr(r.dia),
    cpc: Math.round(r.cpc),
    cpm: Math.round(r.cpm),
    cpl: Math.round(r.cpl),
    cmql: r.cmql == null ? null : Math.round(r.cmql),
  }));

  return (
    <MultiLineChart
      title="Custos"
      description="Custo por etapa · diário"
      data={data}
      xKey="dia"
      lines={[
        { key: "cpc", label: "CPC" },
        { key: "cpm", label: "CPM" },
        { key: "cpl", label: "CPL" },
        { key: "cmql", label: "CMQL" },
      ]}
      valueFormat="currency"
      className="h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Funil de tráfego + resumo
// ---------------------------------------------------------------------------

async function FunilTrafego({ searchParams }: PageProps) {
  const result = await getTrafego(searchParams);

  return (
    <FunnelVertical
      title="Funil de tráfego"
      steps={result.funilTrafego}
      monetaryEtapas={[]}
      className="h-full w-full"
    />
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
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.cliques),
            sumBy(rs, (r) => r.impressoes)
          )
        ),
    },
    {
      key: "cpc",
      header: "CPC",
      align: "right",
      render: (r) => formatBRL(r.cpc),
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.investimento),
            sumBy(rs, (r) => r.cliques)
          )
        ),
    },
    {
      key: "cpm",
      header: "CPM",
      align: "right",
      render: (r) => formatBRL(r.cpm),
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.investimento),
            sumBy(rs, (r) => r.impressoes)
          ) * 1000
        ),
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
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.investimento),
            sumBy(rs, (r) => r.leads)
          )
        ),
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
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.investimento),
            sumBy(rs, (r) => r.mql)
          )
        ),
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

function ChartCardFallback() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-44 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-[280px] w-full animate-pulse rounded bg-muted" />
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
