import { Suspense } from "react";

import { KpiCard, PageShell } from "@/components/page-shell";
import { calcVisaoGeral } from "@/lib/calc/visao-geral";
import {
  formatBRL,
  formatBRLCompact,
  formatInt,
  formatPercent,
} from "@/lib/calc/shared";
import { parseFilters } from "@/lib/filters";
import { readAllSheets } from "@/lib/sheets/read";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function VisaoGeralPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Visão Geral"
      description="Resumo consolidado do funil — tráfego pago, SDR, Closer."
    >
      <Suspense fallback={<KpiSkeleton />}>
        <KpiGrid searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function KpiGrid({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const data = await readAllSheets(["fb_todos", "leads", "sdr", "vendas"]);
  const result = calcVisaoGeral(data, filters);
  const k = result.kpis;

  const kpis = [
    { label: "Investimento", value: formatBRLCompact(k.investimento), hint: "Gasto Meta no período" },
    { label: "MQL", value: formatInt(k.mql), hint: "Leads qualificados (únicos)" },
    { label: "CMQL", value: formatBRL(k.cmql), hint: "Custo por MQL" },
    { label: "Agendamentos", value: formatInt(k.agendamentos), hint: "Reuniões agendadas" },
    { label: "Reuniões Realizadas", value: formatInt(k.reunioes), hint: "Show de reunião" },
    { label: "Vendas", value: formatInt(k.vendas), hint: "Negócios fechados" },
    { label: "Faturamento", value: formatBRLCompact(k.faturamento), hint: "Receita bruta" },
    { label: "CAC", value: formatBRL(k.cac), hint: "Custo de aquisição" },
    { label: "ROAS", value: k.roas.toFixed(2) + "x", hint: "Retorno sobre invest." },
    { label: "Conversão Vendas", value: formatPercent(k.conversaoVendas), hint: "Vendas ÷ MQL" },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
        ))}
      </div>

      <FunilCard funil={result.funilConsolidado} />
    </>
  );
}

function FunilCard({
  funil,
}: {
  funil: { etapa: string; valor: number; conversaoEtapa: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Funil consolidado
        </h3>
        <span className="text-xs text-muted-foreground">
          7 etapas — investimento até venda
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {funil.map((etapa, i) => {
          const max = funil[0].valor || 1;
          const pct = etapa.valor / max;
          const isMonetario = etapa.etapa === "Investimento";
          return (
            <div key={etapa.etapa} className="flex items-center gap-4">
              <div className="w-32 shrink-0 text-sm text-muted-foreground">
                {etapa.etapa}
              </div>
              <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full bg-primary/80 transition-all"
                  style={{ width: `${Math.max(pct * 100, 2)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end px-3">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {isMonetario ? formatBRLCompact(etapa.valor) : formatInt(etapa.valor)}
                  </span>
                </div>
              </div>
              <div className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {i === 0 ? "—" : formatPercent(etapa.conversaoEtapa)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
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
