import type { FilterState, MetasResult, RawData } from "./types";

/**
 * Metas vs Realizado — stub funcional. Lógica completa: PRD §5.2.5.
 */
export function calcMetas(
  _data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "Metas">,
  _filters: FilterState
): MetasResult {
  return { rows: [], resumoPorFunil: [] };
}
