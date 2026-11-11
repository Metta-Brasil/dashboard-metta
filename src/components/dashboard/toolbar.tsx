import { Suspense } from "react";

import type { FilterState } from "@/lib/calc/types";

import { ClearFilters } from "./clear-filters";
import { DateRangePopover } from "./date-range-popover";
import { EscopoFilters, EscopoFiltersFallback } from "./escopo-filters";
import { FunilChips } from "./funil-chips";

type ToolbarProps = {
  from: Date;
  to: Date;
  /** Mostrar funil chips? Default true */
  funil?: boolean;
  /**
   * Página de funil dinâmico: troca o filtro de 5 funis fixos por Funil
   * (lista do dado) + Origem + Pipeline da Clint. `pipeline: false` tira o
   * seletor de pipeline (página que já é de uma pipeline só).
   */
  escopo?: {
    filters: Pick<FilterState, "origem" | "clintPipelines">;
    pipeline?: boolean;
  };
  /** Filtros extras (à direita) */
  extras?: React.ReactNode;
  /** Filtros extras à esquerda, logo depois do funil. */
  leftExtras?: React.ReactNode;
  /** Parâmetros de filtro próprios da página que o "Limpar filtros" também remove. */
  limparExtras?: readonly string[];
};

/** O que o recorte tira da página, dito na tela em vez de um zero mudo. */
function avisoDoEscopo(
  filters: Pick<FilterState, "origem" | "clintPipelines">
): string | null {
  if (filters.clintPipelines?.length) {
    return "Recorte por pipeline da Clint: os números vêm só dos negócios da pipeline. Investimento e MQL não se aplicam e aparecem zerados.";
  }
  if (filters.origem === "organico") {
    return "Somente orgânicos: não há investimento atribuído; investimento e custos aparecem zerados.";
  }
  return null;
}

export function Toolbar({
  from,
  to,
  funil = true,
  escopo,
  extras,
  leftExtras,
  limparExtras,
}: ToolbarProps) {
  // Página sem seletor de pipeline (Resgate) não tem investimento nem MQL
  // para o recorte zerar: o aviso não se aplica.
  const aviso =
    escopo && escopo.pipeline !== false ? avisoDoEscopo(escopo.filters) : null;
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {escopo ? (
            <Suspense fallback={<EscopoFiltersFallback />}>
              <EscopoFilters pipeline={escopo.pipeline ?? true} />
            </Suspense>
          ) : (
            funil && <FunilChips />
          )}
          {leftExtras}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extras}
          <DateRangePopover from={from} to={to} />
          <ClearFilters extra={limparExtras} />
        </div>
      </div>
      {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
    </div>
  );
}
