import { EmptyState, KpiCard, PageShell } from "@/components/page-shell";

const KPIS = [
  { label: "Investimento", hint: "Soma do gasto Meta no período" },
  { label: "MQL", hint: "Leads qualificados" },
  { label: "CMQL", hint: "Custo por MQL" },
  { label: "Reuniões Agendadas", hint: "Tarefas SDR" },
  { label: "Reuniões Realizadas", hint: "Show de reunião" },
  { label: "Vendas", hint: "Negócios fechados" },
  { label: "Faturamento", hint: "Receita bruta" },
  { label: "CAC", hint: "Custo de aquisição" },
  { label: "ROAS", hint: "Retorno sobre invest." },
] as const;

export default function VisaoGeralPage() {
  return (
    <PageShell
      title="Visão Geral"
      description="Resumo consolidado do funil — tráfego pago, SDR, Closer."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {KPIS.map((k) => (
          <KpiCard key={k.label} label={k.label} hint={k.hint} />
        ))}
      </div>
      <EmptyState
        title="Conecte o Google Sheets"
        description="Service Account + Sheets API ainda não configurados. Após o setup, KPIs e gráficos aparecem aqui automaticamente."
      />
    </PageShell>
  );
}
