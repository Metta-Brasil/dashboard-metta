import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  ComboBarLineChart,
  GroupedBarChart,
  DonutChart,
  MultiLineChart,
} from "@/components/dashboard/charts";
import {
  IgPostsTable,
  type IgPostTableRow,
} from "@/components/dashboard/ig-posts-table";
import {
  IgStoriesTable,
  type IgStoryTableRow,
} from "@/components/dashboard/ig-stories-table";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import { formatInt } from "@/lib/calc/shared";
import type { DemografiaItem, IgPostRow, IgResult } from "@/lib/calc/instagram";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SP = Promise<Record<string, string | string[] | undefined>>;

type InstagramPageProps = {
  title: string;
  description: string;
  sp: SP;
  getData: (sp: SP) => Promise<IgResult>;
  /** Elemento extra à esquerda do toolbar (ex: toggle de conta). */
  toolbarLeading?: React.ReactNode;
};

// ---------------------------------------------------------------------------
// Helpers
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

function fmtDelta(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatInt(v)}`;
}

function deltaDir(v: number | null | undefined): "up" | "down" | "neutral" {
  if (v == null || v === 0) return "neutral";
  return v > 0 ? "up" : "down";
}

// ---------------------------------------------------------------------------
// Async Toolbar (inside Suspense — pattern from trafego/page.tsx)
// ---------------------------------------------------------------------------

async function IgToolbar({ sp }: { sp: SP }) {
  const spv = await sp;
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from =
    typeof spv.from === "string"
      ? new Date(`${spv.from}T00:00:00-03:00`)
      : defaultFrom;
  const to =
    typeof spv.to === "string"
      ? new Date(`${spv.to}T00:00:00-03:00`)
      : new Date();

  // Filtro de tipo saiu do header — agora vive dentro da tabela "Todos os posts".
  // O header mantém só período (sempre) + critério da galeria de top posts.
  const extras = (
    <MultiSelectFilter
      param="criterio"
      label="Top por"
      options={[
        { value: "views", label: "Views" },
        { value: "er", label: "Engajamento %" },
        { value: "alcance", label: "Alcance" },
      ]}
      mode="todos"
    />
  );

  return <Toolbar from={from} to={to} funil={false} extras={extras} />;
}

// ---------------------------------------------------------------------------
// Main page component (sync — no dynamic data access at top level)
// ---------------------------------------------------------------------------

export function InstagramPage({
  title,
  description,
  sp,
  getData,
  toolbarLeading,
}: InstagramPageProps) {
  return (
    <PageShell
      title={title}
      description={description}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Suspense>
            {toolbarLeading}
            <IgToolbar sp={sp} />
          </Suspense>
        </div>
      }
    >
      <Suspense fallback={<KpisFallback />}>
        <IgKpisSection getData={getData} sp={sp} />
      </Suspense>

      {/* Evolução de seguidores + Métricas diárias lado a lado (½ cada) */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartFallback />}>
          <IgHistoricoSection getData={getData} sp={sp} />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <IgMetricasDiariasSection getData={getData} sp={sp} />
        </Suspense>
      </div>

      <Suspense fallback={<ChartFallback />}>
        <IgDemografiaSection getData={getData} sp={sp} />
      </Suspense>

      {/* Composição + Média por tipo + Cadência semanal lado a lado (⅓ cada) */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <Suspense fallback={<ChartFallback />}>
          <IgComposicaoSection getData={getData} sp={sp} />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <IgPorTipoSection getData={getData} sp={sp} />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <IgSemanalSection getData={getData} sp={sp} />
        </Suspense>
      </div>

      <Suspense fallback={<GaleriaFallback />}>
        <IgGaleriaSection getData={getData} sp={sp} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={10} />}>
        <IgPostsSection getData={getData} sp={sp} />
      </Suspense>

      <Suspense fallback={<TableFallback rows={6} />}>
        <IgStoriesSection getData={getData} sp={sp} />
      </Suspense>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

async function IgKpisSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { kpis } = result;

  const items: Kpi[] = [
    {
      label: kpis.seguidores.label,
      value: formatInt(kpis.seguidores.value),
      hint: "Snapshot mais recente",
      delta:
        kpis.seguidores.delta != null
          ? {
              value: fmtDelta(kpis.seguidores.delta)!,
              direction: deltaDir(kpis.seguidores.delta),
            }
          : undefined,
    },
    {
      label: kpis.alcance28d.label,
      value: formatInt(kpis.alcance28d.value),
      hint: "Últimos 28 dias",
    },
    {
      label: kpis.viewsPeriodo.label,
      value: formatInt(kpis.viewsPeriodo.value),
      hint:
        kpis.viewsPeriodo.source === "conta"
          ? "Soma diária da conta"
          : "Soma dos posts do período",
      delta:
        kpis.viewsPeriodo.delta != null
          ? {
              value: fmtDelta(kpis.viewsPeriodo.delta)!,
              direction: deltaDir(kpis.viewsPeriodo.delta),
            }
          : undefined,
    },
    {
      label: kpis.interacoes28d.label,
      value: formatInt(kpis.interacoes28d.value),
      hint:
        kpis.interacoes28d.source === "conta"
          ? "Soma diária da conta"
          : "Soma dos posts do período",
      delta:
        kpis.interacoes28d.delta != null
          ? {
              value: fmtDelta(kpis.interacoes28d.delta)!,
              direction: deltaDir(kpis.interacoes28d.delta),
            }
          : undefined,
    },
    {
      label: kpis.postsPeriodo.label,
      value: formatInt(kpis.postsPeriodo.value),
      hint: "Publicados no período",
      delta:
        kpis.postsPeriodo.delta != null
          ? {
              value: fmtDelta(kpis.postsPeriodo.delta)!,
              direction: deltaDir(kpis.postsPeriodo.delta),
            }
          : undefined,
    },
  ];

  return (
    <KpiGrid kpis={items} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
  );
}

// ---------------------------------------------------------------------------
// Histórico — combo barra (ganho) + linha (seguidores)
// ---------------------------------------------------------------------------

async function IgHistoricoSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { historico, hasHistory } = result;

  if (!hasHistory || historico.length === 0) {
    return (
      <EmptyCard
        title="Evolução de seguidores"
        message="Disponível a partir de 2 dias de coleta."
        className="h-full"
      />
    );
  }

  return (
    <ComboBarLineChart
      title="Evolução de seguidores"
      description="Ganho diário (barras) e total acumulado (linha)"
      data={historico}
      xKey="data"
      bars={[{ key: "ganho", label: "Novos seguidores" }]}
      lines={[
        { key: "seguidores", label: "Total seguidores", axis: "right" },
      ]}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Métricas diárias da conta — multi-linha (alcance/views esq. + engajamento dir.)
// ---------------------------------------------------------------------------

async function IgMetricasDiariasSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { metricasDiarias, hasDailyMetrics } = result;

  if (!hasDailyMetrics || metricasDiarias.length === 0) {
    return (
      <EmptyCard
        title="Métricas diárias da conta"
        message="Sem dados diários da conta no período."
        className="h-full"
      />
    );
  }

  return (
    <MultiLineChart
      title="Métricas diárias da conta"
      description="Alcance e views (esq.) · contas engajadas e interações (dir.)"
      data={metricasDiarias.map((p) => ({
        data: p.data,
        Alcance: p.alcanceDia,
        Views: p.viewsDia,
        "Contas engajadas": p.contasEngajadas28d,
        Interações: p.interacoesTotais28d,
      }))}
      xKey="data"
      lines={[
        { key: "Alcance", label: "Alcance" },
        { key: "Views", label: "Views" },
        { key: "Contas engajadas", label: "Contas engajadas", axis: "right" },
        { key: "Interações", label: "Interações", axis: "right" },
      ]}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Composição de interações — donut
// ---------------------------------------------------------------------------

async function IgComposicaoSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { composicao } = result;

  if (composicao.length === 0) {
    return (
      <EmptyCard
        title="Composição de interações"
        message="Nenhum dado no período."
        className="h-full"
      />
    );
  }

  return (
    <DonutChart
      title="Composição de interações"
      description="Posts publicados no período selecionado"
      data={composicao.map((c) => ({ name: c.nome, value: c.valor }))}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Por tipo de mídia — barras agrupadas
// ---------------------------------------------------------------------------

async function IgPorTipoSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { porTipo } = result;

  if (porTipo.length === 0) {
    return (
      <EmptyCard
        title="Média por tipo"
        message="Nenhum post encontrado."
        className="h-full"
      />
    );
  }

  return (
    <GroupedBarChart
      title="Média por tipo de mídia"
      description="Média de views e alcance por formato"
      data={porTipo.map((p) => ({
        tipo: p.tipo,
        Views: p.views,
        Alcance: p.alcance,
      }))}
      xKey="tipo"
      bars={[
        { key: "Views", label: "Views (média)" },
        { key: "Alcance", label: "Alcance (média)" },
      ]}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Semanal — combo barra (posts) + linha (ER médio)
// ---------------------------------------------------------------------------

async function IgSemanalSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { semanal } = result;

  if (semanal.length === 0) {
    return (
      <EmptyCard
        title="Cadência semanal"
        message="Nenhum post no período."
        className="h-full"
      />
    );
  }

  return (
    <ComboBarLineChart
      title="Cadência semanal"
      description="Posts publicados por semana e engajamento médio"
      data={semanal.map((s) => ({
        semana: s.semana,
        Posts: s.posts,
        "ER%": s.erMedio,
      }))}
      xKey="semana"
      bars={[{ key: "Posts", label: "Posts" }]}
      lines={[{ key: "ER%", label: "ER% médio", axis: "right" }]}
      className="h-full w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Demografia de seguidores — faixa×gênero + cidades + países
// ---------------------------------------------------------------------------

function HorizontalBars({
  title,
  description,
  items,
  total,
}: {
  title: string;
  description: string;
  items: DemografiaItem[];
  total: number;
}) {
  const max = Math.max(...items.map((i) => i.seguidores), 1);
  const base = total > 0 ? total : items.reduce((s, i) => s + i.seguidores, 0);

  return (
    <div className="surface-card flex h-full flex-col gap-4 p-5 lg:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="panel-title">{title}</h3>
        <span className="panel-desc">{description}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((it) => {
          const pct = base > 0 ? (it.seguidores / base) * 100 : 0;
          const w = (it.seguidores / max) * 100;
          return (
            <div key={it.nome} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-foreground/90" title={it.nome}>
                  {it.nome}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function IgDemografiaSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { demografia, hasDemografia } = result;

  if (!hasDemografia) {
    return (
      <EmptyCard
        title="Demografia de seguidores"
        message="Sem dados demográficos coletados ainda."
      />
    );
  }

  const temOutros = demografia.idadeGenero.some((d) => d.outros > 0);
  const idadeData = demografia.idadeGenero.map((d) => ({
    faixa: d.faixa,
    Mulheres: d.mulheres,
    Homens: d.homens,
    ...(temOutros ? { Outros: d.outros } : {}),
  }));
  const idadeBars = [
    { key: "Mulheres", label: "Mulheres" },
    { key: "Homens", label: "Homens" },
    ...(temOutros ? [{ key: "Outros", label: "Outros" }] : []),
  ];

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
      {idadeData.length > 0 && (
        <GroupedBarChart
          title="Faixa etária e gênero"
          description="Seguidores por faixa etária, separados por gênero"
          data={idadeData}
          xKey="faixa"
          bars={idadeBars}
          className="h-full w-full"
        />
      )}
      {demografia.cidades.length > 0 && (
        <HorizontalBars
          title="Principais cidades"
          description="% sobre o total de seguidores"
          items={demografia.cidades}
          total={demografia.totalSeguidores}
        />
      )}
      {demografia.paises.length > 0 && (
        <HorizontalBars
          title="Principais países"
          description="% sobre o total de seguidores"
          items={demografia.paises}
          total={demografia.totalSeguidores}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Galeria top 6
// ---------------------------------------------------------------------------

async function IgGaleriaSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);
  const { topPosts } = result;

  if (topPosts.length === 0) return null;

  return (
    <div className="surface-card p-5 lg:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="panel-title">Top posts</h3>
        <span className="panel-desc">Ordenado pelo critério selecionado</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topPosts.map((post) => (
          <IgPostCard key={post.postId} post={post} />
        ))}
      </div>
    </div>
  );
}

function IgPostCard({ post }: { post: IgPostRow }) {
  const hasThumb = !!post.thumbnailUrl;

  return (
    <div className="flex flex-col gap-1.5 overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {hasThumb ? (
          <Image
            src={post.thumbnailUrl}
            alt={post.legenda?.slice(0, 60) || "Post"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {post.tipoLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        <span className="text-[10px] text-muted-foreground">
          {formatDateBr(post.data as Date | null)}
        </span>
        <div className="flex justify-between gap-1 text-[11px] font-medium tabular-nums">
          <span title="Views">{formatInt(post.views)}</span>
          <span title="ER%" className="text-muted-foreground">
            {post.taxaEngajamento.toFixed(1)}%
          </span>
        </div>
        {post.permalink && (
          <Link
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary underline-offset-2 hover:underline"
          >
            Ver post
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela completa de posts (filtro de tipo + busca por legenda dentro da tabela)
// ---------------------------------------------------------------------------

async function IgPostsSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);

  const rows: IgPostTableRow[] = result.allPosts.map((p) => ({
    postId: p.postId,
    tipo: p.tipo,
    tipoLabel: p.tipoLabel,
    legenda: p.legenda,
    dataFmt: formatDateBr(p.data as Date | null),
    dataTs: p.data ? (p.data as Date).getTime() : 0,
    hora: p.hora,
    views: p.views,
    alcance: p.alcance,
    curtidas: p.curtidas,
    comentarios: p.comentarios,
    salvamentos: p.salvamentos,
    visitasPerfil: p.visitasPerfil,
    seguidores: p.seguidores,
    er: p.taxaEngajamento,
    permalink: p.permalink,
  }));

  return <IgPostsTable rows={rows} />;
}

// ---------------------------------------------------------------------------
// Tabela de stories (abaixo da de posts). Append-only: histórico acumula a
// partir da 1ª coleta (a API só devolve stories ativos das últimas 24h).
// ---------------------------------------------------------------------------

async function IgStoriesSection({
  getData,
  sp,
}: {
  getData: InstagramPageProps["getData"];
  sp: SP;
}) {
  const result = await getData(sp);

  const rows: IgStoryTableRow[] = result.allStories.map((s) => ({
    storyId: s.storyId,
    tipo: s.tipo,
    tipoLabel: s.tipoLabel,
    dataFmt: formatDateBr(s.data as Date | null),
    dataTs: s.data ? (s.data as Date).getTime() : 0,
    hora: s.hora,
    views: s.views,
    alcance: s.alcance,
    navegacao: s.navegacao,
    respostas: s.respostas,
    compartilhamentos: s.compartilhamentos,
    interacoes: s.interacoes,
    seguidores: s.seguidores,
    visitasPerfil: s.visitasPerfil,
    permalink: s.permalink,
  }));

  return <IgStoriesTable rows={rows} />;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyCard({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`surface-card flex flex-col gap-2 p-5 lg:p-6 ${className ?? ""}`}
    >
      <h3 className="panel-title">{title}</h3>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallbacks (skeleton)
// ---------------------------------------------------------------------------

export function KpisFallback() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
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

export function ChartFallback() {
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

export function GaleriaFallback() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    </div>
  );
}

export function TableFallback({ rows }: { rows: number }) {
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
