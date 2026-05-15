import { EmptyState, PageShell } from "@/components/page-shell";

export default function MetasPage() {
  return (
    <PageShell
      title="Metas vs Realizado"
      description="Acompanhamento de metas mensais por produto e métrica."
    >
      <EmptyState description="Após criar a aba 'Metas' na planilha (estrutura: produto, métrica, mês, valor), a comparação meta x realizado aparece aqui." />
    </PageShell>
  );
}
