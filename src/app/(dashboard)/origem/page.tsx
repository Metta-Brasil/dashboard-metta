import { Suspense } from "react";

import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import {
  formatBRLCompact,
  formatInt,
  formatPercent,
  safeRate,
} from "@/lib/calc/shared";
import type { OrigemRow } from "@/lib/calc/types";
import { getOrigem, getFilters } from "@/lib/page-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Linha enriquecida com as taxas precomputadas — necessário para que a
 * MetricTable consiga ordenar as colunas de % numericamente (ela lê
 * `row[col.key]` pra obter o sortValue).
 */
type RowWithRates = OrigemRow & {
  pctMqlAgend: number;
  pctAgendReunAg: number;
  pctReunAgReunReal: number;
  pctReunRealVendas: number;
};

const MAX_ROWS = 12;

function enrich(r: OrigemRow): RowWithRates {
  return {
    ...r,
    pctMqlAgend: safeRate(r.agendamentos, r.mql),
    pctAgendReunAg: safeRate(r.reunioesAgendadas, r.agendamentos),
    pctReunAgReunReal: safeRate(r.reunioesRealizadas, r.reunioesAgendadas),
    pctReunRealVendas: safeRate(r.vendas, r.reunioesRealizadas),
  };
}

/** Soma das contagens sobre TODAS as linhas (não só as 12 visíveis). */
function aggregate(rows: OrigemRow[]): OrigemRow {
  const sumOf = (k: keyof OrigemRow): number =>
    rows.reduce(
      (acc, r) => acc + (typeof r[k] === "number" ? (r[k] as number) : 0),
      0
    );
  return {
    dimensao: "Total",
    leadsQualif: sumOf("leadsQualif"),
    mql: sumOf("mql"),
    agendamentos: sumOf("agendamentos"),
    reunioesAgendadas: sumOf("reunioesAgendadas"),
    reunioesRealizadas: sumOf("reunioesRealizadas"),
    vendas: sumOf("vendas"),
    faturamento: sumOf("faturamento"),
  };
}

/** Top 12 por MQL desc + footer com total absoluto (todas as linhas). */
function prepare(rows: OrigemRow[]): {
  top: RowWithRates[];
  footer: RowWithRates;
} {
  const top = [...rows]
    .sort((a, b) => b.mql - a.mql)
    .slice(0, MAX_ROWS)
    .map(enrich);
  const footer = enrich(aggregate(rows));
  return { top, footer };
}

export default function OrigemPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Origem"
      description="Distribuição do funil por UTM, qualificação, cargo, faturamento e segmento."
      toolbar={
        <Suspense fallback={null}>
          <OrigemToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<OrigemSkeleton />}>
        <OrigemContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function OrigemToolbar({ searchParams }: PageProps) {
  const filters = await getFilters(searchParams);
  return <Toolbar from={filters.from} to={filters.to} funil />;
}

/** Render de célula de taxa: "—" quando o denominador é 0. */
function rateCell(num: number, den: number): string {
  return den > 0 ? formatPercent(num / den) : "—";
}

async function OrigemContent({ searchParams }: PageProps) {
  const result = await getOrigem(searchParams);

  // Conjunto base de colunas (contagens + taxas intercaladas). O 1º
  // cabeçalho varia por tabela; é injetado em `cols(...)` abaixo.
  const metricCols: Column<RowWithRates>[] = [
    {
      key: "mql",
      header: "MQL",
      render: (r) => formatInt(r.mql),
      align: "right",
    },
    {
      key: "pctMqlAgend",
      header: "% MQL→Ag",
      render: (r) => rateCell(r.agendamentos, r.mql),
      align: "right",
    },
    {
      key: "agendamentos",
      header: "Agend.",
      render: (r) => formatInt(r.agendamentos),
      align: "right",
    },
    {
      key: "pctAgendReunAg",
      header: "% Ag→ReunAg",
      render: (r) => rateCell(r.reunioesAgendadas, r.agendamentos),
      align: "right",
    },
    {
      key: "reunioesAgendadas",
      header: "Reun. ag.",
      render: (r) => formatInt(r.reunioesAgendadas),
      align: "right",
    },
    {
      key: "pctReunAgReunReal",
      header: "% ReunAg→Real",
      render: (r) => rateCell(r.reunioesRealizadas, r.reunioesAgendadas),
      align: "right",
    },
    {
      key: "reunioesRealizadas",
      header: "Reun. real.",
      render: (r) => formatInt(r.reunioesRealizadas),
      align: "right",
    },
    {
      key: "pctReunRealVendas",
      header: "% Real→Vendas",
      render: (r) => rateCell(r.vendas, r.reunioesRealizadas),
      align: "right",
    },
    {
      key: "vendas",
      header: "Vendas",
      render: (r) => formatInt(r.vendas),
      align: "right",
    },
    {
      key: "faturamento",
      header: "Faturamento",
      render: (r) => formatBRLCompact(r.faturamento),
      align: "right",
    },
  ];

  const cols = (firstHeader: string): Column<RowWithRates>[] => [
    {
      key: "dimensao",
      header: firstHeader,
      render: (r) => r.dimensao,
      align: "left",
    },
    ...metricCols,
  ];

  const faturamentoColumns: Column<RowWithRates>[] = [
    {
      key: "dimensao",
      header: "Faturamento",
      render: (r) => r.dimensao,
      align: "left",
    },
    {
      key: "qualif",
      header: "Qualif.",
      render: (r) => r.qualif ?? "—",
      align: "left",
    },
    ...metricCols,
  ];

  const utmSource = prepare(result.porUtmSource);
  const utmMedium = prepare(result.porUtmMedium);
  const utmCampaign = prepare(result.porUtmCampaign);
  const utmContent = prepare(result.porUtmContent);
  const qualificacao = prepare(result.porQualificacao);
  const cargo = prepare(result.porCargo);
  const faturamento = prepare(result.porFaturamento);
  const segmento = prepare(result.porSegmento);

  return (
    <div className="flex flex-col gap-4">
      <MetricTable
        title="Por UTM Source"
        description={`Top ${MAX_ROWS} por MQL · Total considera todas as origens`}
        columns={cols("Origem")}
        rows={utmSource.top}
        footer={utmSource.footer}
      />
      <MetricTable
        title="Por UTM Medium"
        description={`Top ${MAX_ROWS} por MQL · Total considera todos os medium`}
        columns={cols("Origem")}
        rows={utmMedium.top}
        footer={utmMedium.footer}
      />
      <MetricTable
        title="Por UTM Campaign"
        description={`Top ${MAX_ROWS} por MQL · Total considera todas as campanhas`}
        columns={cols("Campanha")}
        rows={utmCampaign.top}
        footer={utmCampaign.footer}
      />
      <MetricTable
        title="Por UTM Content"
        description={`Top ${MAX_ROWS} por MQL · Total considera todos os conteúdos`}
        columns={cols("Conteúdo")}
        rows={utmContent.top}
        footer={utmContent.footer}
      />
      <MetricTable
        title="Por Qualificação"
        columns={cols("Qualificação")}
        rows={qualificacao.top}
        footer={qualificacao.footer}
      />
      <MetricTable
        title="Por Cargo"
        description={`Top ${MAX_ROWS} por MQL · Total considera todos os cargos`}
        columns={cols("Cargo")}
        rows={cargo.top}
        footer={cargo.footer}
      />
      <MetricTable
        title="Por Faixa de Faturamento"
        columns={faturamentoColumns}
        rows={faturamento.top}
        footer={faturamento.footer}
      />
      <MetricTable
        title="Por Segmento de Mercado"
        description={`Top ${MAX_ROWS} por MQL · Total considera todos os segmentos`}
        columns={cols("Segmento")}
        rows={segmento.top}
        footer={segmento.footer}
      />
    </div>
  );
}

function OrigemSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
