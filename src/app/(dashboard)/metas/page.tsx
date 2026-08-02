import { Suspense } from "react";

import { ProjectionChart } from "@/components/dashboard/charts";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import {
  PacingBars,
  ProgressStatCard,
} from "@/components/dashboard/progress-card";
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
import type {
  MetasCardTaxa,
  MetasHistoricoRow,
  MetricaMetaReal,
} from "@/lib/calc/types";
import { getMetas, getFilters } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MetasPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<MetasSkeleton />}>
      <MetasContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MetasContent({ searchParams }: PageProps) {
  const [result, filters] = await Promise.all([
    getMetas(searchParams),
    getFilters(searchParams),
  ]);

  const byNome = new Map(result.tabelaFunil.map((m) => [m.nome, m]));
  const get = (nome: string): MetricaMetaReal | undefined => byNome.get(nome);
  const taxa = (nome: string): MetasCardTaxa | undefined =>
    result.cardsTaxa.find((c) => c.nome === nome);

  const realMql = get("MQL")?.realValor ?? 0;
  const realReunAg = get("Reuniões agendadas")?.realValor ?? 0;
  const realReunReal = get("Reuniões realizadas")?.realValor ?? 0;

  // ---- Pacing chart -------------------------------------------------------
  const metaTotal =
    result.pacingChart.reduce<number | null>(
      (acc, p) => (p.metaAcumulada != null ? p.metaAcumulada : acc),
      null
    );
  const pacingData = result.pacingChart.map((p) => ({
    dia: String(p.date.getUTCDate()),
    real: p.realAcumulado == null ? null : Math.round(p.realAcumulado),
    proj: p.projecao == null ? null : Math.round(p.projecao),
  }));
  const hojeLabel =
    pacingData[result.pacingDiaAtual - 1]?.dia ??
    pacingData[pacingData.length - 1]?.dia;

  const pacingRows = result.pacingNecessario.map((p) => ({
    label: p.metrica,
    value: formatPacingValor(p.metrica, p.valorPorDia),
    pct: p.pctAvancado,
  }));

  // ---- Histórico mensal ---------------------------------------------------
  const historicoColumns: Column<MetasHistoricoRow>[] = [
    { key: "mes", header: "Mês", render: (r) => formatMesBR(r.mes) },
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
      total: (rs) =>
        formatBRL(
          safeRate(
            sumBy(rs, (r) => r.investimento),
            sumBy(rs, (r) => r.mql)
          )
        ),
    },
    {
      key: "agendamentos",
      header: "Agend.",
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
      header: "Conv.",
      align: "right",
      render: (r) => (r.conversao !== null ? formatPercent(r.conversao) : "—"),
      total: (rs) =>
        formatPercent(
          safeRate(
            sumBy(rs, (r) => r.vendas),
            sumBy(rs, (r) => r.reunioesRealizadas)
          )
        ),
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
      // Meta mensal não vive na linha → média dos meses com meta definida.
      total: (rs) => {
        const v = rs
          .map((r) => r.pctMeta)
          .filter((p): p is number => p !== null && Number.isFinite(p));
        return v.length
          ? formatPercent(v.reduce((a, b) => a + b, 0) / v.length)
          : "—";
      },
    },
  ];

  return (
    <PageShell
      title="Metas vs Realizado"
      description="Acompanhamento de metas mensais por funil e produto."
      toolbar={<Toolbar from={filters.from} to={filters.to} funil />}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        Metas proporcionais ao período selecionado (month-to-date): a meta
        mensal é prorrateada pelos dias do filtro dentro do mês alvo.
      </p>

      {/* Topo do funil */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ProgressStatCard {...absCard(get("Investimento"), { monetary: true })} />
        <ProgressStatCard {...absCard(get("MQL"), { monetary: false })} />
        <ProgressStatCard
          {...absCard(get("Negócios criados"), {
            monetary: false,
            sub: ratioSub(taxa("Tx MQL / Negócio"), "do MQL"),
          })}
        />
      </div>

      {/* Custos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ProgressStatCard {...ceilingCard("CMQL", taxa("CMQL"))} />
        <ProgressStatCard
          {...ceilingCard("Custo/negócio", taxa("Custo/negócio"))}
        />
        <ProgressStatCard
          {...rateCard(
            "Tx MQL → Negócio",
            "negócios criados / MQL",
            taxa("Tx MQL / Negócio"),
            `${formatInt(get("Negócios criados")?.realValor ?? 0)} de ${formatInt(realMql)} MQL`
          )}
        />
      </div>

      {/* Conversões */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ProgressStatCard
          {...absCard(get("Agendamentos"), {
            monetary: false,
            sub: ratioSub(
              taxa("Tx Agendamento / MQL"),
              "do MQL"
            ),
          })}
        />
        <ProgressStatCard
          {...absCard(get("Reuniões agendadas"), {
            monetary: false,
            sub: ratioSubAbs(realReunAg, realMql, "do MQL"),
          })}
        />
        <ProgressStatCard
          {...rateCard(
            "Reuniões realizadas",
            "show (realizadas/agendadas)",
            taxa("Tx Reun. realizada / Reun. agendada"),
            `${formatInt(realReunReal)} de ${formatInt(realReunAg)} agendadas`
          )}
        />
      </div>

      {/* Fim do funil */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ProgressStatCard {...absCard(get("Vendas"), { monetary: false })} />
        <ProgressStatCard
          {...rateCard(
            "Conversão de vendas",
            "vendas / reuniões realizadas",
            taxa("Conversão Vendas / Reun. realizada"),
            `${formatInt(get("Vendas")?.realValor ?? 0)} vendas / ${formatInt(
              realReunReal
            )} reuniões realizadas`
          )}
        />
        <ProgressStatCard
          {...absCard(get("Faturamento"), { monetary: true })}
        />
      </div>

      {/* Projeção + Pacing */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ProjectionChart
          title="Projeção do mês"
          description="Realizado + projeção pelo ritmo atual vs meta"
          data={pacingData}
          xKey="dia"
          realKey="real"
          projKey="proj"
          metaValue={metaTotal}
          metaLabel={
            metaTotal != null ? `meta ${formatBRLCompact(metaTotal)}` : undefined
          }
          hojeLabel={hojeLabel}
          className="h-full w-full"
        />
        <PacingBars
          title="Pacing"
          description="Quanto falta por dia restante pra bater a meta do mês"
          rows={pacingRows}
        />
      </div>

      {/* Histórico mensal */}
      <MetricTable
        title="Histórico mensal"
        description="Últimos 12 meses — investimento, funil e faturamento"
        columns={historicoColumns}
        rows={result.historicoMensal}
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Mapeadores calc → ProgressStatCard
// ---------------------------------------------------------------------------

type CardProps = React.ComponentProps<typeof ProgressStatCard>;

/** Card de métrica absoluta (real vs meta MTD). */
function absCard(
  m: MetricaMetaReal | undefined,
  opts: { monetary: boolean; sub?: string }
): CardProps {
  const fmt = opts.monetary ? formatBRL : (n: number) => formatInt(n);
  const fmtC = opts.monetary ? formatBRLCompact : (n: number) => formatInt(n);
  if (!m) {
    return {
      title: "—",
      value: "—",
      pct: 0,
      footerLeft: "sem dados",
    };
  }
  const hasMeta = m.metaMtdValor != null;
  const pct = m.pctAtingimento ?? 0;
  return {
    title: m.nome,
    metaLabel: hasMeta ? `meta ${fmtC(m.metaMtdValor as number)}` : "sem meta",
    value: fmt(m.realValor),
    metaValue: hasMeta ? `/ ${fmtC(m.metaMtdValor as number)}` : undefined,
    sub: opts.sub,
    pct,
    footerLeft: hasMeta ? `${formatPercent(pct)} atingido` : "—",
    footerRight: gapText(m.gap, opts.monetary),
  };
}

/** Card de teto/inverso (CMQL): menor é melhor. */
function ceilingCard(
  nome: string,
  c: MetasCardTaxa | undefined
): CardProps {
  if (!c || c.realValor == null) {
    return { title: nome, value: "—", pct: 0, footerLeft: "sem dados" };
  }
  const teto = c.metaValor;
  const real = c.realValor;
  const overTeto = teto != null && real > teto;
  const pct = teto != null && teto > 0 ? Math.min(real / teto, 1) : 0;
  return {
    title: nome,
    metaLabel: teto != null ? `teto ${formatBRL(teto)}` : "sem teto",
    value: formatBRL(real),
    pct,
    warn: overTeto,
    footerLeft: overTeto ? "acima do teto" : "abaixo do teto",
    footerRight: teto != null ? `teto ${formatBRL(teto)}` : undefined,
  };
}

/** Card de taxa (show, conversão): real% vs meta%. */
function rateCard(
  title: string,
  metaLabel: string,
  c: MetasCardTaxa | undefined,
  sub: string
): CardProps {
  if (!c || c.realValor == null) {
    return { title, value: "—", pct: 0, footerLeft: "sem dados", sub };
  }
  const real = c.realValor;
  const meta = c.metaValor;
  const hasMeta = meta != null && meta > 0;
  const pct = hasMeta ? Math.min(real / (meta as number), 1) : 0;
  return {
    title,
    metaLabel,
    value: formatPercent(real),
    metaValue: hasMeta ? `/ ${formatPercent(meta as number)}` : undefined,
    sub,
    pct,
    warn: hasMeta ? real < (meta as number) : false,
    footerLeft: hasMeta ? `${formatPercent(pct)} da meta` : "sem meta",
  };
}

function ratioSub(
  c: MetasCardTaxa | undefined,
  suffix: string
): string | undefined {
  if (!c || c.realValor == null) return undefined;
  const real = `${formatPercent(c.realValor)} ${suffix}`;
  return c.metaValor != null
    ? `${real} · meta ${formatPercent(c.metaValor)}`
    : real;
}

function ratioSubAbs(
  num: number,
  den: number,
  suffix: string
): string | undefined {
  if (den <= 0) return undefined;
  return `${formatPercent(num / den)} ${suffix}`;
}

function gapText(gap: number | null, monetary: boolean): string | undefined {
  if (gap == null) return undefined;
  const f = monetary
    ? formatBRL(Math.abs(gap))
    : formatInt(Math.abs(gap));
  if (gap === 0) return "no alvo";
  return gap > 0 ? `+${f}` : `faltam ${f}`;
}

// ---------------------------------------------------------------------------
// Formatadores locais
// ---------------------------------------------------------------------------

function formatPacingValor(metrica: string, valor: number): string {
  const s = metrica.toLowerCase();
  if (s.includes("fatur") || s.includes("invest")) return formatBRL(valor);
  if (s.includes("vend")) return valor.toFixed(2);
  return formatInt(valor);
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
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((__, i) => (
            <div
              key={i}
              className="surface-card flex h-[170px] flex-col gap-3 p-5"
            >
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-7 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-auto h-2 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card h-72 animate-pulse" />
        <div className="surface-card h-72 animate-pulse" />
      </div>
      <div className="surface-card h-64 animate-pulse" />
    </PageShell>
  );
}
