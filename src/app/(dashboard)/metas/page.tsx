import { Suspense } from "react";

import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import { calcMetas } from "@/lib/calc/metas";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
} from "@/lib/calc/shared";
import type {
  MetasCardTaxa,
  MetasHistoricoRow,
  MetasPacingNecessario,
  MetasPacingPoint,
  MetricaMetaReal,
} from "@/lib/calc/types";
import { parseFilters } from "@/lib/filters";
import { readAllSheets } from "@/lib/sheets/read";
import { cn } from "@/lib/utils";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PACING_CHART_LIMIT = 30;

export default function MetasPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<MetasSkeleton />}>
      <MetasContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MetasContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const data = await readAllSheets([
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "Metas",
  ]);
  const result = calcMetas(data, filters);

  // ---- Funil columns ------------------------------------------------------
  const funilColumns: Column<MetricaMetaReal>[] = [
    {
      key: "nome",
      header: "Métrica",
      render: (r) => r.nome,
    },
    {
      key: "real",
      header: "Real",
      align: "right",
      render: (r) => formatMetricaValor(r.nome, r.realValor),
    },
    {
      key: "meta",
      header: "Meta MTD",
      align: "right",
      render: (r) =>
        r.metaMtdValor !== null
          ? formatMetricaValor(r.nome, r.metaMtdValor)
          : "—",
    },
    {
      key: "pct",
      header: "% atingimento",
      align: "right",
      render: (r) =>
        r.pctAtingimento !== null ? formatPercent(r.pctAtingimento) : "—",
    },
    {
      key: "gap",
      header: "Gap",
      align: "right",
      render: (r) => renderGap(r.nome, r.gap),
    },
  ];

  // ---- Pacing chart (visualmente limitada aos últimos 30 dias) ------------
  const pacingChartFull = result.pacingChart;
  const pacingChartRows =
    pacingChartFull.length > PACING_CHART_LIMIT
      ? pacingChartFull.slice(pacingChartFull.length - PACING_CHART_LIMIT)
      : pacingChartFull;

  const pacingChartColumns: Column<MetasPacingPoint>[] = [
    {
      key: "date",
      header: "Data",
      render: (r) => formatDataBR(r.date),
    },
    {
      key: "real",
      header: "Real acumulado",
      align: "right",
      render: (r) => formatBRL(r.realAcumulado),
    },
    {
      key: "meta",
      header: "Meta acumulada",
      align: "right",
      render: (r) =>
        r.metaAcumulada !== null ? formatBRL(r.metaAcumulada) : "—",
    },
  ];

  // ---- Pacing necessário --------------------------------------------------
  const pacingNecessarioColumns: Column<MetasPacingNecessario>[] = [
    {
      key: "metrica",
      header: "Métrica",
      render: (r) => r.metrica,
    },
    {
      key: "valorPorDia",
      header: "Valor/dia necessário",
      align: "right",
      render: (r) => formatPacingValor(r.metrica, r.valorPorDia),
    },
    {
      key: "pctAvancado",
      header: "% avançado",
      align: "right",
      render: (r) => formatPercent(r.pctAvancado),
    },
  ];

  // ---- Histórico mensal ---------------------------------------------------
  const historicoColumns: Column<MetasHistoricoRow>[] = [
    {
      key: "mes",
      header: "Mês",
      render: (r) => formatMesBR(r.mes),
    },
    {
      key: "investimento",
      header: "Invest",
      align: "right",
      render: (r) => formatBRLCompact(r.investimento),
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
      render: (r) => (r.cmql !== null ? formatBRL(r.cmql) : "—"),
    },
    {
      key: "agendamentos",
      header: "Agend",
      align: "right",
      render: (r) => formatInt(r.agendamentos),
    },
    {
      key: "reunioesRealizadas",
      header: "Reun. real.",
      align: "right",
      render: (r) => formatInt(r.reunioesRealizadas),
    },
    {
      key: "vendas",
      header: "Vendas",
      align: "right",
      render: (r) => formatInt(r.vendas),
    },
    {
      key: "conversao",
      header: "Conv",
      align: "right",
      render: (r) => (r.conversao !== null ? formatPercent(r.conversao) : "—"),
    },
    {
      key: "faturamento",
      header: "Faturamento",
      align: "right",
      render: (r) => formatBRLCompact(r.faturamento),
    },
    {
      key: "pctMeta",
      header: "% meta",
      align: "right",
      render: (r) => (r.pctMeta !== null ? formatPercent(r.pctMeta) : "—"),
    },
  ];

  const hero = result.hero;
  const pacingDescricao =
    pacingChartFull.length > PACING_CHART_LIMIT
      ? `Real acumulado vs meta linear — últimos ${PACING_CHART_LIMIT} dias`
      : "Real acumulado vs meta linear — mês alvo";

  return (
    <PageShell
      title="Metas vs Realizado"
      description="Acompanhamento de metas mensais por funil e produto."
      toolbar={<Toolbar from={filters.from} to={filters.to} funil />}
    >
      {/* Hero — Faturamento */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Faturamento
        </span>
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatBRLCompact(hero.realFaturamento)}
        </span>
        <div className="text-sm text-muted-foreground">
          <span>
            Meta MTD:{" "}
            {hero.metaFaturamentoMtd !== null
              ? formatBRLCompact(hero.metaFaturamentoMtd)
              : "—"}
          </span>
          <span className="mx-2">·</span>
          <span>
            Atingimento:{" "}
            {hero.pctAtingimento !== null
              ? formatPercent(hero.pctAtingimento)
              : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span
            className={cn(
              "tabular-nums",
              hero.gap === null && "text-muted-foreground",
              hero.gap !== null && hero.gap >= 0 && "text-emerald-600",
              hero.gap !== null && hero.gap < 0 && "text-rose-600"
            )}
          >
            {renderHeroGap(hero.gap)}
          </span>
          <span className="text-muted-foreground">
            Projeção fim do mês:{" "}
            <span className="tabular-nums text-foreground">
              {formatBRLCompact(hero.projecaoFimDoMes)}
            </span>
          </span>
        </div>
      </div>

      {/* Tabela funil meta x real */}
      <MetricTable
        title="Funil — Meta x Real"
        description="Comparação por etapa do funil no período"
        columns={funilColumns}
        rows={result.tabelaFunil}
      />

      {/* 4 cards de taxa */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {result.cardsTaxa.map((card) => (
          <TaxaCard key={card.nome} card={card} />
        ))}
      </div>

      {/* Pacing chart (tabela) */}
      <MetricTable
        title="Pacing — Faturamento acumulado"
        description={pacingDescricao}
        columns={pacingChartColumns}
        rows={pacingChartRows}
      />

      {/* Pacing necessário */}
      <MetricTable
        title="Pacing necessário"
        description="Quanto falta por dia restante pra bater a meta total do mês"
        columns={pacingNecessarioColumns}
        rows={result.pacingNecessario}
      />

      {/* Histórico mensal */}
      <MetricTable
        title="Histórico mensal (últimos 12 meses)"
        description="Evolução de investimento, funil e faturamento por mês"
        columns={historicoColumns}
        rows={result.historicoMensal}
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Cards de taxa
// ---------------------------------------------------------------------------

function TaxaCard({ card }: { card: MetasCardTaxa }) {
  const value = card.realValor !== null ? formatTaxaValor(card) : "—";
  const meta = card.metaValor !== null ? formatTaxaMeta(card) : "—";

  // Sinal: bom/ruim depende de isInverse.
  let tone: "good" | "bad" | "neutral" = "neutral";
  if (card.realValor !== null && card.metaValor !== null && card.metaValor > 0) {
    const realMelhor = card.isInverse
      ? card.realValor <= card.metaValor
      : card.realValor >= card.metaValor;
    tone = realMelhor ? "good" : "bad";
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {card.nome}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-rose-600",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">Meta: {meta}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatadores locais
// ---------------------------------------------------------------------------

function isMetricaMonetaria(nome: string): boolean {
  const s = nome.toLowerCase();
  return s.includes("invest") || s.includes("fatur") || s.includes("receita");
}

function formatMetricaValor(nome: string, valor: number): string {
  if (isMetricaMonetaria(nome)) return formatBRL(valor);
  return formatInt(valor);
}

function renderGap(nome: string, gap: number | null): React.ReactNode {
  if (gap === null) return "—";
  const monetario = isMetricaMonetaria(nome);
  const formatted = monetario ? formatBRL(Math.abs(gap)) : formatInt(Math.abs(gap));
  if (gap === 0) {
    return <span className="text-muted-foreground">0</span>;
  }
  if (gap > 0) {
    return <span className="text-emerald-600">+{formatted}</span>;
  }
  return <span className="text-rose-600">-{formatted}</span>;
}

function renderHeroGap(gap: number | null): string {
  if (gap === null) return "Gap: —";
  if (gap === 0) return "No alvo da meta MTD";
  if (gap > 0) return `Acima ${formatBRL(gap)}`;
  return `Faltam ${formatBRL(Math.abs(gap))}`;
}

function formatTaxaValor(card: MetasCardTaxa): string {
  if (card.realValor === null) return "—";
  if (card.nome === "CMQL") return formatBRL(card.realValor);
  return formatPercent(card.realValor);
}

function formatTaxaMeta(card: MetasCardTaxa): string {
  if (card.metaValor === null) return "—";
  if (card.nome === "CMQL") return formatBRL(card.metaValor);
  return formatPercent(card.metaValor);
}

function formatPacingValor(metrica: string, valor: number): string {
  const s = metrica.toLowerCase();
  if (s.includes("fatur") || s.includes("invest")) return formatBRL(valor);
  return formatInt(valor);
}

function formatDataBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const MESES_PT_ABBR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatMesBR(d: Date): string {
  const m = MESES_PT_ABBR[d.getUTCMonth()] ?? "";
  return `${m}/${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MetasSkeleton() {
  return (
    <PageShell
      title="Metas vs Realizado"
      description="Acompanhamento de metas mensais por funil e produto."
    >
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card p-6 shadow-xs" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card p-5 shadow-xs" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[110px] flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border border-border bg-card p-5 shadow-xs"
        />
      ))}
    </PageShell>
  );
}
