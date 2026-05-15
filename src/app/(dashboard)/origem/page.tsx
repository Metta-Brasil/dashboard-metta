import { EmptyState, PageShell } from "@/components/page-shell";

export default function OrigemPage() {
  return (
    <PageShell
      title="Origem"
      description="Distribuição de leads, reuniões e vendas por origem (UTM, formulário, conteúdo)."
    >
      <EmptyState />
    </PageShell>
  );
}
