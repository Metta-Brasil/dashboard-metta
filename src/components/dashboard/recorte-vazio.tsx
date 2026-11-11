import Link from "next/link";

import { dayKey } from "@/lib/calc/shared";
import type { FilterState } from "@/lib/calc/types";

type Props = {
  /** A página não tem nenhum número neste recorte. */
  vazio: boolean;
  /** Rota da página, para o link de saída. */
  rota: string;
  /** O que a página conta, no plural: "negócios, leads ou vendas". */
  oQue: string;
  filters: Pick<
    FilterState,
    "from" | "to" | "funis" | "origem" | "clintPipelines" | "tags" | "sdr"
  >;
};

const dia = (d: Date): string => {
  const [y, m, dd] = dayKey(d).split("-");
  return `${dd}/${m}/${y}`;
};

/**
 * Bloco de estado vazio das páginas de funil dinâmico. O layout completo
 * continua de pé com zeros (um card de aviso no lugar dele faria o zero
 * parecer falha de carregamento); este bloco entra ACIMA, diz qual é o
 * recorte e, havendo filtro ativo, dá a saída: o mesmo período sem filtros.
 */
export function RecorteVazio({ vazio, rota, oQue, filters }: Props) {
  if (!vazio) return null;
  const funilAtivo = (filters.funis ?? []).some((f) => f !== "tudo" && f !== "todos");
  const temFiltro =
    funilAtivo ||
    Boolean(filters.origem && filters.origem !== "todos") ||
    Boolean(filters.clintPipelines?.length) ||
    Boolean(filters.tags?.length) ||
    Boolean(filters.sdr?.length);
  const saida = `${rota}?from=${dayKey(filters.from)}&to=${dayKey(filters.to)}`;

  return (
    <div className="surface-card flex flex-col items-start gap-2 p-4 lg:p-6">
      <h3 className="panel-title">Nada neste recorte</h3>
      <p className="panel-desc">
        Nenhum registro de {oQue} entre {dia(filters.from)} e {dia(filters.to)}
        {temFiltro ? " com os filtros selecionados." : "."}
      </p>
      {temFiltro && (
        <Link
          href={saida}
          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground"
        >
          Ver o período sem filtros →
        </Link>
      )}
    </div>
  );
}
