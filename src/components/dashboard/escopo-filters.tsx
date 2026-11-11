import { getEscopoOpcoes } from "@/lib/page-data";

import { FunilChips } from "./funil-chips";
import { MultiSelectFilter } from "./multi-select-filter";
import { OrigemToggle } from "./origem-toggle";

/**
 * Filtros das páginas de funil dinâmico: Funil (lista tirada do dado),
 * Origem (pagos × orgânicos) e, onde faz sentido, Pipeline da Clint.
 * As opções vêm da base inteira, sem corte de período.
 */
export async function EscopoFilters({ pipeline = true }: { pipeline?: boolean }) {
  const { funis, pipelines } = await getEscopoOpcoes();
  return (
    <>
      <FunilChips options={funis.map(({ value, label }) => ({ value, label }))} />
      <OrigemToggle />
      {pipeline && (
        <MultiSelectFilter
          param="clintPipeline"
          label="Pipeline Clint"
          options={pipelines.map(({ value, label }) => ({ value, label }))}
          mode="plain"
        />
      )}
    </>
  );
}

/** Enquanto as opções carregam: os controles que não dependem do dado. */
export function EscopoFiltersFallback() {
  return (
    <>
      <FunilChips />
      <OrigemToggle />
    </>
  );
}
