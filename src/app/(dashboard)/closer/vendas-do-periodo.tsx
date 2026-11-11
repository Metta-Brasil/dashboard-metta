import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { formatBRL, formatInt } from "@/lib/calc/shared";
import type { CloserVendaRow } from "@/lib/calc/types";
import { getCloser } from "@/lib/page-data";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDataBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Tabela "Vendas do período" do Comercial Closer: uma linha por venda, com
 * o NOME DO COMPRADOR. Mora em arquivo próprio (e não dentro de
 * `page.tsx`) porque o MCP bloqueia esta seção pela identidade do
 * componente — ver `FORA_DO_MCP` em `src/lib/mcp/render/registry.ts`. Não
 * a incorpore de volta na página: o bloqueio deixaria de existir.
 *
 * `getCloser` é memoizado pela promise de `searchParams`, então buscar
 * aqui não repete leitura nem cálculo.
 */
export async function VendasDoPeriodo({ searchParams }: Props) {
  const result = await getCloser(searchParams);

  const vendasColumns: Column<CloserVendaRow>[] = [
    {
      key: "data",
      header: "Data",
      render: (r) => formatDataBR(r.data),
    },
    {
      key: "comprador",
      header: "Comprador",
      render: (r) => r.comprador || "—",
    },
    {
      key: "funil",
      header: "Funil",
      render: (r) => r.funil || "—",
    },
    {
      key: "produto",
      header: "Produto",
      render: (r) => r.produto,
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      render: (r) => formatBRL(r.valor),
    },
    {
      key: "sdr",
      header: "SDR",
      render: (r) => r.sdr ?? "—",
    },
    {
      key: "ciclo",
      header: "Ciclo (dias)",
      align: "right",
      render: (r) => (r.ciclo !== null ? formatInt(r.ciclo) : "—"),
      // Ciclo médio: média das vendas com ciclo conhecido (não somar dias).
      total: (rs) => {
        const v = rs
          .map((r) => r.ciclo)
          .filter((c): c is number => c !== null && Number.isFinite(c));
        return v.length
          ? formatInt(v.reduce((a, b) => a + b, 0) / v.length)
          : "—";
      },
    },
  ];

  return (
    <MetricTable
      title="Vendas do período"
      description="Detalhamento das vendas no intervalo selecionado"
      columns={vendasColumns}
      rows={result.vendasDoPeriodo}
    />
  );
}
