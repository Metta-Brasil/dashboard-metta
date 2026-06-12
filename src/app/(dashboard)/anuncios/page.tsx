import { Suspense } from "react";

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
import type { AnuncioCard, AnunciosResult } from "@/lib/calc/types";
import { getAnuncios, getFilters } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AnunciosPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Anúncios"
      description="Top criativos por CPL, CMQL e vendas — galeria e ranking."
      toolbar={
        <Suspense fallback={null}>
          <AnunciosToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<AnunciosSkeleton />}>
        <AnunciosContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function AnunciosToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

async function AnunciosContent({ searchParams }: PageProps) {
  const result: AnunciosResult = await getAnuncios(searchParams);

  return (
    <>
      <TopCardsRow result={result} />
      <Galeria items={result.galeria} />
      <RankingTable rows={result.tabelaAnuncios} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Top por… (3 cards lado-a-lado)
// ---------------------------------------------------------------------------

type TopMetric = "mql" | "agendamento" | "reunioesRealizadas";

function TopCardsRow({ result }: { result: AnunciosResult }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <TopCard
        title="Top MQL"
        description="Mais MQL"
        items={result.topMql}
        metric="mql"
      />
      <TopCard
        title="Top Agendamento"
        description="Mais agendamentos"
        items={result.topAgendamento}
        metric="agendamento"
      />
      <TopCard
        title="Top Reuniões realizadas"
        description="Mais reuniões realizadas"
        items={result.topReunioesRealizadas}
        metric="reunioesRealizadas"
      />
    </div>
  );
}

function TopCard({
  title,
  description,
  items,
  metric,
}: {
  title: string;
  description: string;
  items: AnuncioCard[];
  metric: TopMetric;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sem dados no período.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, i) => (
            <TopCardRow
              key={`${metric}-${item.adName}`}
              rank={i + 1}
              item={item}
              metric={metric}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TopCardRow({
  rank,
  item,
  metric,
}: {
  rank: number;
  item: AnuncioCard;
  metric: TopMetric;
}) {
  const primaryLabel =
    metric === "mql"
      ? "MQL"
      : metric === "agendamento"
        ? "Agend"
        : "Reun. real.";
  const primaryValue =
    metric === "mql"
      ? formatInt(item.mql)
      : metric === "agendamento"
        ? formatInt(item.agendamentos)
        : formatInt(item.reunioesRealizadas);

  const secondaryLabel = "Vendas";
  const secondaryValue = formatInt(item.vendas);

  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-sm font-medium text-foreground"
          title={item.adName}
        >
          {item.adName}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-semibold text-foreground">{primaryValue}</span>
            <span className="ml-1 text-muted-foreground">{primaryLabel}</span>
          </span>
          <span className="tabular-nums">
            {secondaryValue}
            <span className="ml-1">{secondaryLabel}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Galeria de criativos
// ---------------------------------------------------------------------------

function Galeria({ items }: { items: AnuncioCard[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Galeria de criativos
          </h3>
          <span className="text-xs text-muted-foreground">
            6 anúncios campeões por MQL no período.
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sem criativos com atividade no período.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CreativeCard key={item.adName} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreativeCard({ item }: { item: AnuncioCard }) {
  const hasThumb = item.thumbnailUrl !== "";
  const hasIg = item.instagramPermalink !== "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.adName}
            width={240}
            height={240}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Sem thumbnail
          </div>
        )}
      </div>
      <span
        className="line-clamp-2 text-sm font-medium text-foreground"
        title={item.adName}
      >
        {item.adName}
      </span>
      <dl className="flex flex-col gap-2.5 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <CreativeMetric
            label="Investimento"
            value={formatBRLCompact(item.investimento)}
          />
          <CreativeMetric label="CMQL" value={formatBRL(item.cmql)} />
          <CreativeMetric label="MQL" value={formatInt(item.mql)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CreativeMetric label="Agend" value={formatInt(item.agendamentos)} />
          <CreativeMetric
            label="Reun. real."
            value={formatInt(item.reunioesRealizadas)}
          />
          <CreativeMetric label="Vendas" value={formatInt(item.vendas)} />
        </div>
      </dl>
      {hasIg ? (
        <a
          href={item.instagramPermalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ver no Instagram
        </a>
      ) : (
        <span className="inline-flex items-center justify-center rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
          Sem link
        </span>
      )}
    </div>
  );
}

function CreativeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking de anúncios (tabela 15 colunas)
// ---------------------------------------------------------------------------

const RANKING_COLUMNS: Column<AnuncioCard>[] = [
  {
    key: "adName",
    header: "Anúncio",
    align: "left",
    render: (r) => (
      <span className="block max-w-[260px] truncate" title={r.adName}>
        {r.adName}
      </span>
    ),
  },
  {
    key: "investimento",
    header: "Invest",
    align: "right",
    render: (r) => formatBRLCompact(r.investimento),
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
    // Planilha (Análise Tráfego G5): MÉDIA do CTR por anúncio.
    total: (rs) =>
      formatPercent(rs.length ? sumBy(rs, (r) => r.ctr) / rs.length : 0),
  },
  {
    key: "cpc",
    header: "CPC",
    align: "right",
    render: (r) => formatBRL(r.cpc),
    // Planilha (Análise Tráfego H5): MÉDIA do CPC por anúncio.
    total: (rs) =>
      formatBRL(rs.length ? sumBy(rs, (r) => r.cpc) / rs.length : 0),
  },
  {
    key: "cpm",
    header: "CPM",
    align: "right",
    render: (r) => formatBRL(r.cpm),
    // Planilha (Análise Tráfego I5): MÉDIA do CPM por anúncio.
    total: (rs) =>
      formatBRL(rs.length ? sumBy(rs, (r) => r.cpm) / rs.length : 0),
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
    render: (r) => formatBRL(r.cmql),
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
    header: "Agend",
    align: "right",
    render: (r) => formatInt(r.agendamentos),
  },
  {
    key: "reunioesAgendadas",
    header: "Reun. ag.",
    align: "right",
    render: (r) => formatInt(r.reunioesAgendadas),
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
];

function RankingTable({ rows }: { rows: AnuncioCard[] }) {
  return (
    <MetricTable
      title="Ranking de anúncios"
      description="Todos os criativos com atividade no período (ordenados por CMQL)."
      columns={RANKING_COLUMNS}
      rows={rows}
      empty="Nenhum anúncio com atividade no período."
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AnunciosSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[220px] flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-2 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="h-8 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
            <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-[400px] animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
