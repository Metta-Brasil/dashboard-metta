import type { Metadata } from "next";
import { Suspense } from "react";

import { BarList } from "@/components/dashboard/bar-list";
import { ComboBarLineChart } from "@/components/dashboard/charts";
import { FunnelVertical } from "@/components/dashboard/funnel-vertical";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { TimeInStage } from "@/components/dashboard/time-in-stage";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
} from "@/lib/calc/shared";
import type { ResgateKpi, ResgateNegocioRow } from "@/lib/calc/types";
import { getFilters, getResgate } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "Funil de Resgate · Dashboard Metta",
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

function formatKpi(k: ResgateKpi): string {
  // null = métrica sem medição. "—" em vez de 0: zero se lê como resultado
  // medido, e aqui não houve medição.
  if (k.value === null) return "—";
  if (k.format === "brl") return formatBRLCompact(k.value);
  if (k.format === "percent") return formatPercent(k.value);
  return formatInt(k.value);
}

export default function ResgatePage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Funil de Resgate"
      toolbar={
        <Suspense fallback={null}>
          <ResgateToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <AvisoColuna searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<KpisFallback />}>
        <ResgateKpis searchParams={searchParams} />
      </Suspense>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <Suspense fallback={<FunilFallback />}>
          <div className="flex flex-col lg:col-span-1">
            <Funil searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<FunilFallback />}>
          <div className="flex flex-col lg:col-span-1">
            <TempoParado searchParams={searchParams} />
          </div>
        </Suspense>

        <Suspense fallback={<ChartCardFallback />}>
          <div className="flex flex-col lg:col-span-1">
            <Movimentacoes searchParams={searchParams} />
          </div>
        </Suspense>
      </div>

      <Suspense fallback={<TableFallback rows={4} />}>
        <PerfilDaBase searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={8} />}>
        <TabelaNegocios searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ResgateToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} funil={false} />;
}

/**
 * A pipeline é selecionada pelo `pipelineId`, coluna nova na aba `clint`.
 * Enquanto a aba não for reimportada do DB Negócios, ela chega vazia — e a
 * página tem que dizer isso, não exibir um funil zerado como se fosse
 * resultado medido.
 */
async function AvisoColuna({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  if (r.temColunaPipeline) return null;
  return (
    <div className="rounded-xl border border-amber-600/20 bg-amber-50 p-4 text-sm text-amber-800">
      <strong className="font-semibold">Coluna Pipeline ainda não chegou.</strong>{" "}
      O <code>metta-clint-sync</code> já grava a pipeline de cada negócio nas
      colunas AG/AH do <em>DB Negócios</em>, mas a aba <code>clint</code> ainda
      está com as 37 colunas antigas. Estenda a importação até a coluna AM para
      a página encher.
    </div>
  );
}

async function ResgateKpis({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  const kpis: Kpi[] = r.kpis.map((k) => ({
    label: k.label,
    value: formatKpi(k),
    hint: k.hint,
  }));
  return <KpiGrid kpis={kpis} cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />;
}

async function Funil({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  const desc =
    r.perdidos > 0
      ? `Posição atual dos ${formatInt(r.total)} negócios · ${formatInt(r.perdidos)} perdido(s) fora do eixo`
      : `Posição atual dos ${formatInt(r.total)} negócios`;
  // Largura distribuída linearmente de 100% (topo) a 40% (base). O taper
  // padrão do componente cai -15 por etapa e bate no piso de 20% já na 7ª:
  // com 9 etapas as três últimas saíam idênticas e com o rótulo truncado.
  const n = r.funil.length;
  const widths = r.funil.map((_, i) =>
    n <= 1 ? 100 : 100 - (i / (n - 1)) * 60
  );
  return (
    <FunnelVertical
      title="Funil de resgate"
      description={desc}
      steps={r.funil}
      monetaryEtapas={[]}
      widths={widths}
      className="h-full w-full"
    />
  );
}

async function TempoParado({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  if (!r.tempoEmEtapa.length) {
    return (
      <div className="surface-card flex h-full flex-col gap-1 p-5 lg:p-6">
        <h3 className="panel-title">Tempo parado na etapa</h3>
        <span className="panel-desc">Sem data de entrada na etapa.</span>
      </div>
    );
  }
  return (
    <TimeInStage
      title="Tempo parado na etapa"
      description="Dias corridos desde a última movimentação do card, por etapa atual."
      points={r.tempoEmEtapa}
      className="h-full"
    />
  );
}

async function Movimentacoes({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  const data = r.serieMovimentos.map((p) => ({
    dia: formatDayBr(p.dia),
    movimentacoes: p.movimentacoes,
  }));
  return (
    <ComboBarLineChart
      title="Movimentações por dia"
      description="Cards cuja última movimentação caiu no dia. Vira série real de passagem quando o snapshot diário estiver ligado."
      data={data}
      xKey="dia"
      bars={[{ key: "movimentacoes", label: "Cards movidos" }]}
      lines={[]}
      className="h-full"
    />
  );
}

async function PerfilDaBase({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
      <BarList
        title="Qualificação"
        description="negócios"
        data={r.perfilQualificacao}
      />
      <BarList
        title="Faturamento"
        description="negócios"
        data={r.perfilFaturamento}
      />
      <BarList
        title="Funil de origem"
        description="negócios"
        data={r.perfilFunil}
      />
      <BarList
        title="Campanha de origem"
        description="negócios"
        data={r.perfilCampanha}
      />
    </div>
  );
}

async function TabelaNegocios({ searchParams }: PageProps) {
  const r = await getResgate(searchParams);

  const columns: Column<ResgateNegocioRow>[] = [
    {
      key: "nome",
      header: "Nome",
      total: "none",
      render: (n) => (
        <span className="block max-w-[200px] truncate" title={n.nome}>
          {n.nome || "—"}
        </span>
      ),
    },
    {
      key: "contato",
      header: "Contato",
      total: "none",
      render: (n) => n.contato || "—",
    },
    {
      key: "qualificacao",
      header: "Qualificação",
      total: "none",
      render: (n) => n.qualificacao || "—",
    },
    {
      key: "faturamento",
      header: "Faturamento",
      total: "none",
      render: (n) => n.faturamento || "—",
    },
    {
      key: "utmCampaign",
      header: "Campanha de origem",
      total: "none",
      render: (n) => (
        <span className="block max-w-[240px] truncate" title={n.utmCampaign}>
          {n.utmCampaign || "—"}
        </span>
      ),
    },
    {
      key: "macroEtapa",
      header: "Etapa",
      total: "none",
      render: (n) => (
        <span title={n.etapa !== n.macroEtapa ? n.etapa : undefined}>
          {n.macroEtapa}
        </span>
      ),
    },
    {
      key: "diasParado",
      header: "Dias parado",
      align: "right",
      total: "none",
      render: (n) => (n.diasParado === null ? "—" : formatInt(n.diasParado)),
    },
    {
      key: "dono",
      header: "Dono",
      total: "none",
      render: (n) => n.dono || "—",
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      render: (n) => formatBRL(n.valor),
    },
  ];

  return (
    <MetricTable
      title="Negócios na pipeline"
      description={`${formatInt(r.total)} negócio(s) · ordenado por profundidade no funil e tempo parado.`}
      columns={columns}
      rows={r.negocios}
      empty="Nenhum negócio na pipeline Operação Resgate."
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
