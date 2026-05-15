import { EmptyState, PageShell } from "@/components/page-shell";

export default function CloserPage() {
  return (
    <PageShell
      title="Comercial Closer"
      description="Reuniões realizadas, taxa de fechamento e ticket médio por Closer."
    >
      <EmptyState />
    </PageShell>
  );
}
