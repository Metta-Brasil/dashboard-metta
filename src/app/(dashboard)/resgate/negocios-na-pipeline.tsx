import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { formatBRL, formatInt } from "@/lib/calc/shared";
import type { ResgateNegocioRow } from "@/lib/calc/types";
import { getResgate } from "@/lib/page-data";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Tabela "Negócios na pipeline" do Funil de Resgate: uma linha por negócio,
 * com NOME e CONTATO (Instagram ou telefone) do lead. Mora em arquivo
 * próprio (e não dentro de `page.tsx`) porque o MCP bloqueia esta seção
 * pela identidade do componente — ver `FORA_DO_MCP` em
 * `src/lib/mcp/render/registry.ts`. Não a incorpore de volta na página: o
 * bloqueio deixaria de existir.
 */
export async function TabelaNegocios({ searchParams }: Props) {
  const r = await getResgate(searchParams);

  const columns: Column<ResgateNegocioRow>[] = [
    {
      key: "nome",
      header: "Nome",
      total: "none",
      render: (n) => (
        <span className="block max-w-[200px] truncate" title={n.nome}>
          {n.nome || "—"}
        </span>
      ),
    },
    {
      key: "contato",
      header: "Contato",
      total: "none",
      render: (n) => n.contato || "—",
    },
    {
      key: "qualificacao",
      header: "Qualificação",
      total: "none",
      render: (n) => n.qualificacao || "—",
    },
    {
      key: "faturamento",
      header: "Faturamento",
      total: "none",
      render: (n) => n.faturamento || "—",
    },
    {
      key: "utmCampaign",
      header: "Campanha de origem",
      total: "none",
      render: (n) => (
        <span className="block max-w-[240px] truncate" title={n.utmCampaign}>
          {n.utmCampaign || "—"}
        </span>
      ),
    },
    {
      key: "macroEtapa",
      header: "Etapa",
      total: "none",
      render: (n) => (
        <span title={n.etapa !== n.macroEtapa ? n.etapa : undefined}>
          {n.macroEtapa}
        </span>
      ),
    },
    {
      key: "diasParado",
      header: "Dias parado",
      align: "right",
      total: "none",
      render: (n) => (n.diasParado === null ? "—" : formatInt(n.diasParado)),
    },
    {
      key: "dono",
      header: "Dono",
      total: "none",
      render: (n) => n.dono || "—",
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      render: (n) => formatBRL(n.valor),
    },
  ];

  return (
    <MetricTable
      title="Negócios na pipeline"
      description={`${formatInt(r.total)} negócio(s) · ordenado por profundidade no funil e tempo parado.`}
      columns={columns}
      rows={r.negocios}
      maxRows={15}
      empty="Nenhum negócio na pipeline Operação Resgate."
    />
  );
}
