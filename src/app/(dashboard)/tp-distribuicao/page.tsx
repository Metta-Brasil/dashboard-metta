import type { Metadata } from "next";
import { Suspense } from "react";

import { ComboBarLineChart } from "@/components/dashboard/charts";
import { ContaFilter } from "@/components/dashboard/conta-filter";
import { DistModoToggle } from "@/components/dashboard/dist-modo-toggle";
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
import type { TpDistKpi, TpDistTableRow } from "@/lib/calc/types";
import { getFilters, getTpDistribuicao } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "TP Distribuição · Dashboard Metta",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDayBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function formatKpi(k: TpDistKpi): string {
  // null = métrica ausente na fonte. Mostrar "—" em vez de 0/R$ 0,00:
  // zero se lê como resultado medido, e aqui não houve medição.
  if (k.value === null) return "—";
  if (k.format === "brl") return formatBRLCompact(k.value);
  if (k.format === "percent") return formatPercent(k.value);
  return formatInt(k.value);
}

/**
 * Σimpressões reconstruída para os totais derivados de CPM/CTR/Hook rate.
 * A row não carrega `impressions` cru (não é coluna), mas CPM = spent/impr
 * *1000 ⇒ impr = spent/cpm*1000 por linha; somar dá Σimpr fiel.
 */
function impressoesFromRows(rs: TpDistTableRow[]): number {
  return sumBy(rs, (r) => (r.cpm > 0 ? (r.investimento / r.cpm) * 1000 : 0));
}

export default function TpDistribuicaoPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="TP Distribuição de conteúdo"
      description="Performance das campanhas de distribuição (DIST) — vídeo e seguidores."
      toolbar={
        <Suspense fallback={null}>
          <TpDistToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<KpisFallback />}>
        <TpDistKpis searchParams={searchParams} />
      </Suspense>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <Suspense fallback={<ChartCardFallback />}>
          <div className="flex flex-col lg:col-span-2">
            <EvolucaoDiaria searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<FunilFallback />}>
          <div className="flex flex-col lg:col-span-1">
            <FunilDist searchParams={searchParams} />
          </div>
        </Suspense>
      </div>

      <Suspense fallback={<TableFallback rows={6} />}>
        <TabelaDist searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Toolbar — período padrão + filtros extras (conta + modo). Sem FunilChips.
// ---------------------------------------------------------------------------

async function TpDistToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return (
    <Toolbar
      from={filters.from}
      to={filters.to}
      funil={false}
      extras={
        <>
          <ContaFilter />
          <DistModoToggle />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// KPIs — 6 cards (ordem/label/format vêm do calc)
// ---------------------------------------------------------------------------

async function TpDistKpis({ searchParams }: PageProps) {
  const result = await getTpDistribuicao(searchParams);
  const kpis: Kpi[] = result.kpis.map((k) => ({
    label: k.label,
    value: formatKpi(k),
    hint: k.hint,
  }));
  return (
    <KpiGrid kpis={kpis} cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />
  );
}

// ---------------------------------------------------------------------------
// Evolução diária — série condicionada ao modo
// ---------------------------------------------------------------------------

async function EvolucaoDiaria({ searchParams }: PageProps) {
  const result = await getTpDistribuicao(searchParams);

  if (result.modo === "video") {
    const data = result.serie.map((r) => ({
      dia: formatDayBr(r.dia),
      investimento:
        typeof r.investimento === "number" ? Math.round(r.investimento) : null,
      video95: typeof r.video95 === "number" ? r.video95 : null,
      cpv95:
        typeof r.cpv95 === "number" ? Math.round(r.cpv95 * 100) / 100 : null,
    }));
    return (
      <ComboBarLineChart
        title="Investimento, Visualizações 95% e CPV 95% · diário"
        description="Barras (Investimento + Views 95%) + linha (CPV 95%, eixo direito)"
        data={data}
        xKey="dia"
        bars={[
          { key: "investimento", label: "Investimento" },
          { key: "video95", label: "Visualizações 95%" },
        ]}
        lines={[{ key: "cpv95", label: "CPV 95%", axis: "right" }]}
        className="h-full"
      />
    );
  }

  const data = result.serie.map((r) => ({
    dia: formatDayBr(r.dia),
    investimento:
      typeof r.investimento === "number" ? Math.round(r.investimento) : null,
    seguidores: typeof r.seguidores === "number" ? r.seguidores : null,
    visitasPerfil: typeof r.visitasPerfil === "number" ? r.visitasPerfil : null,
    custoSeguidor:
      typeof r.custoSeguidor === "number"
        ? Math.round(r.custoSeguidor * 100) / 100
        : null,
  }));
  return (
    <ComboBarLineChart
      title="Investimento, Seguidores e Custo · diário"
      description="Barras (Investimento) + linhas (Seguidores/Visitas; Custo p/ seguidor no eixo direito)"
      data={data}
      xKey="dia"
      bars={[{ key: "investimento", label: "Investimento" }]}
      lines={[
        { key: "seguidores", label: "Seguidores", axis: "left" },
        { key: "visitasPerfil", label: "Visitas ao perfil", axis: "left" },
        { key: "custoSeguidor", label: "Custo p/ seguidor", axis: "right" },
      ]}
      className="h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Funil — etapas condicionadas ao modo
// ---------------------------------------------------------------------------

async function FunilDist({ searchParams }: PageProps) {
  const result = await getTpDistribuicao(searchParams);
  return (
    <FunnelVertical
      title="Funil"
      steps={result.funil}
      monetaryEtapas={[]}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Tabela — colunas condicionadas ao modo (por adName)
// ---------------------------------------------------------------------------

const NOME_COL: Column<TpDistTableRow> = {
  key: "adName",
  header: "Nome do anúncio",
  total: "none",
  render: (r) => (
    <span className="block max-w-[280px] truncate" title={r.adName}>
      {r.adName}
    </span>
  ),
};

async function TabelaDist({ searchParams }: PageProps) {
  const result = await getTpDistribuicao(searchParams);

  const columns: Column<TpDistTableRow>[] =
    result.modo === "video"
      ? [
          NOME_COL,
          {
            key: "investimento",
            header: "Investimento",
            align: "right",
            render: (r) => formatBRL(r.investimento),
          },
          {
            key: "hookRate",
            header: "Hook rate",
            align: "right",
            render: (r) => formatPercent(r.hookRate),
            total: (rs) =>
              formatPercent(
                safeRate(
                  sumBy(rs, (r) => r.video3s),
                  impressoesFromRows(rs)
                )
              ),
          },
          {
            key: "video3s",
            header: "Visualizações 3s",
            align: "right",
            render: (r) => formatInt(r.video3s),
          },
          {
            key: "video25",
            header: "Visualizações 25%",
            align: "right",
            render: (r) => formatInt(r.video25),
          },
          {
            key: "cpv25",
            header: "CPV 25%",
            align: "right",
            render: (r) => formatBRL(r.cpv25),
            total: (rs) =>
              formatBRL(
                safeRate(
                  sumBy(rs, (r) => r.investimento),
                  sumBy(rs, (r) => r.video25)
                )
              ),
          },
          {
            key: "video95",
            header: "Visualizações 95%",
            align: "right",
            render: (r) => formatInt(r.video95),
          },
          {
            key: "cpv95",
            header: "CPV 95%",
            align: "right",
            render: (r) => formatBRL(r.cpv95),
            total: (rs) =>
              formatBRL(
                safeRate(
                  sumBy(rs, (r) => r.investimento),
                  sumBy(rs, (r) => r.video95)
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
                  impressoesFromRows(rs)
                ) * 1000
              ),
          },
        ]
      : [
          NOME_COL,
          {
            key: "investimento",
            header: "Investimento",
            align: "right",
            render: (r) => formatBRL(r.investimento),
          },
          {
            key: "cliques",
            header: "Cliques",
            align: "right",
            render: (r) => formatInt(r.cliques),
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
            key: "ctr",
            header: "CTR",
            align: "right",
            render: (r) => formatPercent(r.ctr),
            total: (rs) =>
              formatPercent(
                safeRate(
                  sumBy(rs, (r) => r.cliques),
                  impressoesFromRows(rs)
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
                  impressoesFromRows(rs)
                ) * 1000
              ),
          },
          {
            key: "visitasPerfil",
            header: "Visitas ao perfil",
            align: "right",
            render: (r) => formatInt(r.visitasPerfil),
          },
          {
            key: "custoVisita",
            header: "Custo p/ visita",
            align: "right",
            render: (r) => formatBRL(r.custoVisita),
            total: (rs) =>
              formatBRL(
                safeRate(
                  sumBy(rs, (r) => r.investimento),
                  sumBy(rs, (r) => r.visitasPerfil)
                )
              ),
          },
          {
            key: "seguidores",
            header: "Seguidores",
            align: "right",
            render: (r) => formatInt(r.seguidores),
          },
          {
            key: "custoSeguidor",
            header: "Custo p/ seguidor",
            align: "right",
            render: (r) => formatBRL(r.custoSeguidor),
            total: (rs) =>
              formatBRL(
                safeRate(
                  sumBy(rs, (r) => r.investimento),
                  sumBy(rs, (r) => r.seguidores)
                )
              ),
          },
          {
            key: "visitasSeguidores",
            header: "Visitas > Seguidores",
            align: "right",
            render: (r) => formatPercent(r.visitasSeguidores),
            total: (rs) =>
              formatPercent(
                safeRate(
                  sumBy(rs, (r) => r.seguidores),
                  sumBy(rs, (r) => r.visitasPerfil)
                )
              ),
          },
        ];

  const desc =
    result.modo === "video"
      ? "Por anúncio · ordenado por investimento."
      : "Por anúncio · ordenado por seguidores.";

  return (
    <MetricTable
      title="Anúncios"
      description={desc}
      columns={columns}
      rows={result.tabela}
      empty="Sem anúncios no período."
    />
  );
}

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

function KpisFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[110px] flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-7 w-28 animate-pulse rounded bg-muted" />
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
