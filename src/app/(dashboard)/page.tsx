import { Suspense } from "react";

import {
  ComboBarLineChart,
  DonutChart,
  MultiLineChart,
} from "@/components/dashboard/charts";
import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import {
  MetricTable,
  type Column,
} from "@/components/dashboard/metric-table";
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
  TabelaDiariaRow,
  TabelaDiariaTotal,
} from "@/lib/calc/types";
import { getFilters, getVisaoGeral } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FUNIL_LABELS: Record<Funil, string> = {
  sala: "Sala",
  aplica: "Aplicação",
  sessao: "Sessão",
  isca: "Isca",
  reality: "Reality",
  todos: "Todos",
};

function fmtDayShort(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function fmtDayFull(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function nullable(value: number | null, fmt: (n: number) => string): string {
  return value == null ? "—" : fmt(value);
}

export default function VisaoGeralPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Visão Geral"
      description="Resumo consolidado do funil — tráfego pago, SDR, Closer."
      toolbar={
        <Suspense fallback={null}>
          <VisaoGeralToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<SectionFallback label="Carregando KPIs…" />}>
        <KpisSection searchParams={searchParams} />
      </Suspense>

      {/* Linha 1 — Evolução (largo) + Funil consolidado (estreito) */}
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        <div className="flex lg:col-span-2">
          <Suspense fallback={<SectionFallback label="Carregando evolução…" />}>
            <EvolucaoDiariaSection searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="flex lg:col-span-1">
          <Suspense fallback={<SectionFallback label="Carregando funil…" />}>
            <FunilSection searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      {/* Linha 2 — Distribuição (estreito) + Custo por etapa (largo) */}
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        <div className="flex lg:col-span-1">
          <Suspense
            fallback={<SectionFallback label="Carregando distribuição…" />}
          >
            <DistribuicaoSection searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="flex lg:col-span-2">
          <Suspense fallback={<SectionFallback label="Carregando custo…" />}>
            <CustoPorEtapaSection searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      {/* Linha 3 — Tabela diária, largura total */}
      <Suspense fallback={<SectionFallback label="Carregando tabela diária…" />}>
        <TabelaDiariaSection searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function VisaoGeralToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} />;
}

// ---------------------------------------------------------------------------
// Async sections — todas chamam getVisaoGeral (memoizado via React.cache),
// então o fetch+calc roda UMA vez por request, compartilhado entre as 6.
// ---------------------------------------------------------------------------

const loadVisaoGeral = getVisaoGeral;

async function KpisSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);
  const k = result.kpis;

  const leadsDelta = k.leadsDelta
    ? {
        value: formatPercent(k.leadsDelta.value),
        direction: k.leadsDelta.direction,
      }
    : undefined;

  const kpis: Kpi[] = [
    {
      label: "Investimento",
      value: formatBRLCompact(k.investimento),
      hint: `CPL ${formatBRL(k.cpl)}`,
    },
    {
      label: "Leads",
      value: formatInt(k.leads),
      hint: "Leads únicos (dedup)",
      delta: leadsDelta,
    },
    {
      label: "MQL",
      value: formatInt(k.mql),
      hint: `CMQL ${formatBRL(k.cmql)}`,
    },
    {
      label: "Reuniões realizadas",
      value: formatInt(k.reunioes),
      hint: `Show ${formatPercent(k.show)}`,
    },
    {
      label: "Vendas",
      value: formatInt(k.vendas),
      hint: `Conv R→V ${formatPercent(k.convReunParaVenda)}`,
    },
    {
      label: "Faturamento",
      value: formatBRLCompact(k.faturamento),
      hint: "Receita bruta",
    },
    {
      label: "Ticket médio",
      value: formatBRLCompact(k.ticketMedio),
      hint: "Faturamento ÷ Vendas",
    },
    {
      label: "ROAS",
      value: `${k.roas.toFixed(2)}x`,
      hint: "Receita ÷ Investimento",
    },
    {
      label: "CAC",
      value: formatBRL(k.cac),
      hint: "Investimento ÷ Vendas",
    },
    {
      label: "Pipeline",
      value: formatBRLCompact(k.pipeline),
      hint: `${formatInt(k.propostasEmAberto)} propostas em aberto`,
    },
  ];

  return <KpiGrid kpis={kpis} />;
}

async function FunilSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);
  return (
    <FunnelVertical
      title="Funil consolidado"
      description="Leads até venda"
      steps={result.funilConsolidado}
      monetaryEtapas={[]}
      className="h-full w-full"
    />
  );
}

async function EvolucaoDiariaSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);

  const data = result.serieDiaria.map((r) => ({
    dia: fmtDayShort(r.dia),
    mql: r.mql,
    reunioes: r.reunioes,
    vendas: r.vendas,
    conv: r.convMqlVenda == null ? null : Number((r.convMqlVenda * 100).toFixed(1)),
  }));

  return (
    <ComboBarLineChart
      title="Evolução: MQL · Reuniões Realizadas · Vendas"
      description="Barras (volumes) + linha de conversão acumulada Vendas/MQL"
      data={data}
      xKey="dia"
      bars={[
        { key: "mql", label: "MQL" },
        { key: "reunioes", label: "Reuniões realizadas" },
        { key: "vendas", label: "Vendas" },
      ]}
      lines={[
        { key: "conv", label: "% Conv. acumulada", axis: "right" },
      ]}
      className="h-full w-full"
    />
  );
}

async function CustoPorEtapaSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);

  const data = result.custoPorEtapa.map((r) => ({
    dia: fmtDayShort(r.dia),
    cpl: r.cpl,
    cmql: r.cmql,
    cac: r.cac,
  }));

  return (
    <MultiLineChart
      title="Custo por etapa (CPL · CMQL · CAC) — diário"
      description="Escala dupla: CPL/CMQL à esquerda, CAC à direita"
      data={data}
      xKey="dia"
      lines={[
        { key: "cpl", label: "CPL" },
        { key: "cmql", label: "CMQL" },
        { key: "cac", label: "CAC", axis: "right" },
      ]}
      className="h-full w-full"
    />
  );
}

async function DistribuicaoSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);

  const data = result.distribuicaoPorFunil
    .map((r) => ({
      name: FUNIL_LABELS[r.funil] ?? r.funil,
      value: r.mql,
    }))
    .filter((d) => d.value > 0);

  const totalMql = data.reduce((s, d) => s + d.value, 0);

  return (
    <DonutChart
      title="Distribuição por funil"
      description="MQL por funil dentro do período"
      data={data}
      centerLabel="MQL total"
      centerValue={formatInt(totalMql)}
      className="h-full w-full"
    />
  );
}

type TabelaDiariaRowOrTotal =
  | (TabelaDiariaRow & { __kind: "row" })
  | (TabelaDiariaTotal & { __kind: "total" });

async function TabelaDiariaSection({ searchParams }: PageProps) {
  const result = await loadVisaoGeral(searchParams);

  const rows: TabelaDiariaRowOrTotal[] = result.tabelaDiaria.map((r) => ({
    ...r,
    __kind: "row" as const,
  }));
  const footer: TabelaDiariaRowOrTotal = {
    ...result.tabelaDiariaTotal,
    __kind: "total" as const,
  };

  const renderData = (r: TabelaDiariaRowOrTotal): string =>
    r.__kind === "row" ? fmtDayFull(r.dia) : "TOTAL";

  const columns: Column<TabelaDiariaRowOrTotal>[] = [
    { key: "data", header: "Data", render: renderData },
    {
      key: "investimento",
      header: "Investimento",
      align: "right",
      render: (r) => formatBRL(r.investimento),
    },
    {
      key: "mql",
      header: "MQL",
      align: "right",
      render: (r) => formatInt(r.mql),
    },
    {
      key: "custoPorMql",
      header: "Custo/MQL",
      align: "right",
      render: (r) => nullable(r.custoPorMql, formatBRL),
    },
    {
      key: "agendamentos",
      header: "Agendamentos",
      align: "right",
      render: (r) => formatInt(r.agendamentos),
    },
    {
      key: "mqlParaAgend",
      header: "MQL→Agend",
      align: "right",
      render: (r) => nullable(r.mqlParaAgend, (n) => formatPercent(n)),
    },
    {
      key: "reunioesAgendadas",
      header: "Reun. agendadas",
      align: "right",
      render: (r) => formatInt(r.reunioesAgendadas),
    },
    {
      key: "mqlParaReunAg",
      header: "MQL→Reun. ag.",
      align: "right",
      render: (r) => nullable(r.mqlParaReunAg, (n) => formatPercent(n)),
    },
    {
      key: "reunioesRealizadas",
      header: "Reun. realizadas",
      align: "right",
      render: (r) => formatInt(r.reunioesRealizadas),
    },
    {
      key: "show",
      header: "Show",
      align: "right",
      render: (r) => nullable(r.show, (n) => formatPercent(n)),
    },
    {
      key: "vendas",
      header: "Vendas",
      align: "right",
      render: (r) => formatInt(r.vendas),
    },
    {
      key: "conversao",
      header: "Conversão",
      align: "right",
      render: (r) => nullable(r.conversao, (n) => formatPercent(n)),
    },
    {
      key: "faturamento",
      header: "Faturamento",
      align: "right",
      render: (r) => formatBRL(r.faturamento),
    },
  ];

  return (
    <MetricTable<TabelaDiariaRowOrTotal>
      title="Tabela diária"
      description="Detalhamento dia a dia com totais consolidados"
      columns={columns}
      rows={rows}
      footer={footer}
    />
  );
}

// ---------------------------------------------------------------------------
// Fallback simples pras suspenses
// ---------------------------------------------------------------------------

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="surface-card flex h-full w-full flex-col gap-4 p-5 lg:p-6">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-64 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="min-h-48 flex-1 animate-pulse rounded-lg bg-muted/60" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
