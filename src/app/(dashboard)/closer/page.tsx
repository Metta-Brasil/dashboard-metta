import { Suspense } from "react";

import { AreaLineChart, DonutChart } from "@/components/dashboard/charts";
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
import type { CloserRow, CloserVendaRow } from "@/lib/calc/types";
import { getCloser, getFilters } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CloserPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<CloserSkeleton />}>
      <CloserContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CloserContent({ searchParams }: PageProps) {
  const [result, filters] = await Promise.all([
    getCloser(searchParams),
    getFilters(searchParams),
  ]);
  const k = result.kpis;

  const kpis: Kpi[] = [
    {
      label: "Vendas",
      value: formatInt(k.vendas),
      hint: "Negócios fechados no período",
    },
    {
      label: "Receita",
      value: formatBRLCompact(k.faturamento),
      hint: "Faturamento bruto",
    },
    {
      label: "Ticket médio",
      value: formatBRL(k.ticketMedio),
      hint: "Receita ÷ vendas",
    },
    {
      label: "ROAS",
      value: k.roas !== null ? `${formatBRL(k.roas)}x` : "—",
      hint: "Receita ÷ investimento",
    },
    {
      label: "Ciclo médio",
      value: k.cicloMedio !== null ? `${formatInt(k.cicloMedio)} dias` : "—",
      hint: "Inscrição → compra",
    },
    {
      label: "Ciclo R→V",
      value:
        k.cicloMedioReuniaoVenda !== null
          ? `${formatInt(k.cicloMedioReuniaoVenda)} dias`
          : "—",
      hint: "Reunião realizada → venda",
    },
  ];

  const receitaPorFunilData = result.receitaPorFunil.map((r) => ({
    name: capitalizeFunil(r.funil),
    value: Math.round(r.receita),
  }));
  const receitaTotal = result.receitaPorFunil.reduce(
    (acc, r) => acc + r.receita,
    0
  );

  const evolucaoData = result.evolucao12Meses.map((r) => ({
    mes: formatMesBR(r.mes),
    receita: Math.round(r.receita),
    meta: r.meta == null ? null : Math.round(r.meta),
  }));

  const vendasColumns: Column<CloserVendaRow>[] = [
    {
      key: "data",
      header: "Data",
      render: (r) => formatDataBR(r.data),
    },
    {
      key: "comprador",
      header: "Comprador",
      render: (r) => r.comprador || "—",
    },
    {
      key: "funil",
      header: "Funil",
      render: (r) => r.funil || "—",
    },
    {
      key: "produto",
      header: "Produto",
      render: (r) => r.produto,
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      render: (r) => formatBRL(r.valor),
    },
    {
      key: "sdr",
      header: "SDR",
      render: (r) => r.sdr ?? "—",
    },
    {
      key: "pagamento",
      header: "Pagamento",
      render: (r) => r.pagamento || "—",
    },
    {
      key: "ciclo",
      header: "Ciclo (dias)",
      align: "right",
      render: (r) => (r.ciclo !== null ? formatInt(r.ciclo) : "—"),
      // Ciclo médio: média das vendas com ciclo conhecido (não somar dias).
      total: (rs) => {
        const v = rs
          .map((r) => r.ciclo)
          .filter((c): c is number => c !== null && Number.isFinite(c));
        return v.length
          ? formatInt(v.reduce((a, b) => a + b, 0) / v.length)
          : "—";
      },
    },
  ];

  const closerColumns: Column<CloserRow>[] = [
    {
      key: "closer",
      header: "Closer",
      render: (r) => r.closer,
    },
    {
      key: "agendou",
      header: "Agendou",
      align: "right",
      render: (r) => formatInt(r.agendou),
    },
    {
      key: "realizou",
      header: "Realizou",
      align: "right",
      render: (r) => formatInt(r.realizou),
    },
    {
      key: "show",
      header: "Show%",
      align: "right",
      render: (r) => formatPercent(r.show),
      // Denominador (reuniões marcadas) não vive na linha → média da coluna.
      total: (rs) =>
        formatPercent(
          rs.length ? sumBy(rs, (r) => r.show) / rs.length : 0
        ),
    },
    {
      key: "propostas",
      header: "Propostas",
      align: "right",
      render: (r) => formatInt(r.propostas),
    },
    {
      key: "txProposta",
      header: "Tx prop.",
      align: "right",
      render: (r) => formatPercent(r.txProposta),
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
      header: "Valor prop.",
      align: "right",
      render: (r) => formatBRL(r.valorProp),
    },
    {
      key: "vendas",
      header: "Vendas",
      align: "right",
      render: (r) => formatInt(r.vendas),
    },
    {
      key: "close",
      header: "Close%",
      align: "right",
      render: (r) => formatPercent(r.close),
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.vendas),
            sumBy(rs, (r) => r.propostas)
          )
        ),
    },
    {
      key: "faturamento",
      header: "Faturamento",
      align: "right",
      render: (r) => formatBRL(r.faturamento),
    },
    {
      key: "ticketMedio",
      header: "Ticket médio",
      align: "right",
      render: (r) => formatBRL(r.ticketMedio),
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.faturamento),
            sumBy(rs, (r) => r.vendas)
          )
        ),
    },
  ];

  return (
    <PageShell
      title="Comercial Closer"
      description="Reuniões realizadas, taxa de fechamento e ticket médio por Closer."
      toolbar={<Toolbar from={filters.from} to={filters.to} funil />}
    >
      <KpiGrid kpis={kpis} cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />

      {/* g-2 do #p4: Receita por funil (donut) + Evolução de receita */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="flex">
          <DonutChart
            title="Receita por funil"
            description="Distribuição de faturamento por funil de origem"
            data={receitaPorFunilData}
            centerLabel="Receita total"
            centerValue={formatBRLCompact(receitaTotal)}
            className="h-full w-full"
          />
        </div>
        <div className="flex">
          <AreaLineChart
            title="Evolução de receita (12 meses)"
            description="Faturamento mensal vs meta"
            data={evolucaoData}
            xKey="mes"
            area={{ key: "receita", label: "Receita" }}
            lines={[{ key: "meta", label: "Meta", dashed: true }]}
            className="h-full w-full"
          />
        </div>
      </div>

      <MetricTable
        title="Vendas do período"
        description="Detalhamento das vendas no intervalo selecionado"
        columns={vendasColumns}
        rows={result.vendasDoPeriodo}
      />

      <MetricTable
        title="Performance por Closer"
        description="Agendamentos, propostas e fechamento por closer"
        columns={closerColumns}
        rows={result.porCloser}
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Helpers locais (formatadores específicos desta página)
// ---------------------------------------------------------------------------

function capitalizeFunil(funil: string): string {
  if (!funil) return "—";
  const map: Record<string, string> = {
    sala: "Sala",
    aplica: "Aplica",
    sessao: "Sessão",
    isca: "Isca",
    reality: "Reality",
    "up-sell": "Up-sell",
    outros: "Outros",
  };
  return map[funil] ?? funil.charAt(0).toUpperCase() + funil.slice(1);
}

function formatDataBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatMesBR(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${yyyy}`;
}

function CloserSkeleton() {
  return (
    <PageShell
      title="Comercial Closer"
      description="Reuniões realizadas, taxa de fechamento e ticket médio por Closer."
    >
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
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border border-border bg-card p-5 shadow-xs"
        />
      ))}
    </PageShell>
  );
}
