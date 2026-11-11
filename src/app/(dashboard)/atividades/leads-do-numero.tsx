import Link from "next/link";

import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { ATV_LISTAS, parseAtvLista, type AtvLead } from "@/lib/calc/atividades";
import { formatInt } from "@/lib/calc/shared";
import { getAtividades } from "@/lib/page-data";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** "2026-11-05" → "05/11/2026" (chave de calendário, sem fuso). */
function formatDiaKey(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

/**
 * Tabela "Leads por trás do número" da página Comercial Atividades: uma
 * linha por lead com ação no período, com o NOME do lead. Clicar num
 * indicador (param `lista`) mostra só os leads que aquele número conta.
 *
 * Mora em arquivo próprio (e não dentro de `page.tsx`) porque o MCP bloqueia
 * esta seção pela identidade do componente — ver `FORA_DO_MCP` em
 * `src/lib/mcp/render/registry.ts`. Não a incorpore de volta na página: o
 * bloqueio deixaria de existir.
 */
export async function LeadsDoNumero({ searchParams }: Props) {
  const [r, spv] = await Promise.all([getAtividades(searchParams), searchParams]);
  const lista = parseAtvLista(spv.lista);
  const leads = lista ? r.leads.filter(ATV_LISTAS[lista].tem) : r.leads;

  // Link que fecha a lista do indicador e volta a todos os leads do período.
  const semLista = new URLSearchParams();
  for (const [k, v] of Object.entries(spv)) {
    if (k !== "lista" && typeof v === "string") semLista.set(k, v);
  }

  const columns: Column<AtvLead>[] = [
    {
      key: "nome",
      header: "Lead",
      total: "none",
      render: (l) => (
        <span className="block max-w-[220px] truncate" title={l.nome || undefined}>
          {l.nome || "Contato sem negócio"}
        </span>
      ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      total: "none",
      render: (l) => (
        <span className="block max-w-[220px] truncate" title={l.pipeline}>
          {l.pipeline || "—"}
        </span>
      ),
    },
    { key: "etapa", header: "Etapa hoje", total: "none", render: (l) => l.etapa || "—" },
    { key: "funil", header: "Funil", total: "none", render: (l) => l.funil || "Sem funil" },
    {
      key: "pessoas",
      header: "Quem atuou",
      total: "none",
      render: (l) => l.pessoas.join(", ") || "—",
    },
    { key: "ligFeitas", header: "Ligações", align: "right", render: (l) => formatInt(l.ligFeitas) },
    { key: "lig30", header: "30s+", align: "right", render: (l) => formatInt(l.lig30) },
    {
      key: "mensagens",
      header: "Mensagens",
      align: "right",
      render: (l) => formatInt(l.msgClint + l.msgCelular),
    },
    {
      key: "respondeu",
      header: "Respondeu",
      total: "none",
      render: (l) => (l.respondeu ? "Sim" : "—"),
    },
    { key: "reunioes", header: "Reuniões", align: "right", render: (l) => formatInt(l.reunioes) },
    {
      key: "ultimoDia",
      header: "Última ação",
      total: "none",
      render: (l) => formatDiaKey(l.ultimoDia),
    },
  ];

  return (
    <div id="leads" className="scroll-mt-24">
      <MetricTable
        title={lista ? ATV_LISTAS[lista].titulo : "Leads trabalhados no período"}
        description={
          lista
            ? `${formatInt(leads.length)} lead(s) por trás do número.`
            : `${formatInt(leads.length)} lead(s) com ação no período. Clique num número acima para ver só os leads dele.`
        }
        toolbar={
          lista ? (
            <Link
              href={`?${semLista.toString()}`}
              scroll={false}
              className="inline-flex items-center rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-foreground"
            >
              Ver todos os leads
            </Link>
          ) : undefined
        }
        columns={columns}
        rows={leads}
        maxRows={15}
        empty="Nenhum lead neste recorte."
      />
    </div>
  );
}
