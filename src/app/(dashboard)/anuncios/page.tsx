import { EmptyState, PageShell } from "@/components/page-shell";

export default function AnunciosPage() {
  return (
    <PageShell
      title="Anúncios"
      description="Top criativos por leads, vendas e ROAS."
    >
      <EmptyState />
    </PageShell>
  );
}
