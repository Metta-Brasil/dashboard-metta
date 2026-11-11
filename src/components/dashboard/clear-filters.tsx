"use client";

import { FILTER_PARAMS } from "./filter-options";
import { useUrlState } from "./use-url-state";

/**
 * "Limpar filtros": só existe quando algum filtro está fora do padrão (um
 * botão permanentemente apagado é ruído na barra mais clicada). Remove os
 * filtros e o período; não toca nos parâmetros de navegação (a conta, o
 * modo ou a pipeline escolhidos sobrevivem à limpeza).
 */
export function ClearFilters({ extra }: { extra?: readonly string[] }) {
  const { params, setParams, pending } = useUrlState();
  const keys = [...FILTER_PARAMS, ...(extra ?? [])];
  if (!keys.some((k) => params.has(k))) return null;

  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      onClick={() =>
        setParams((p) => {
          for (const k of keys) p.delete(k);
        })
      }
      className="inline-flex h-9 cursor-pointer items-center rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      Limpar filtros
    </button>
  );
}
