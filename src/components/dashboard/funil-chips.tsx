"use client";

import { FUNIL_OPTIONS, type FilterOption } from "./filter-options";
import { MultiSelectFilter } from "./multi-select-filter";

/**
 * Filtro "Funil". Sem `options`, os 5 funis pagos de sempre (TP Aquisição,
 * Anúncios). As páginas de funil dinâmico passam a lista tirada do dado
 * (`getEscopoOpcoes`), onde um funil novo aparece sozinho.
 */
export function FunilChips({ options }: { options?: FilterOption[] }) {
  return (
    <MultiSelectFilter
      param="funis"
      label="Funil"
      options={options ?? FUNIL_OPTIONS}
      mode="todos"
    />
  );
}
