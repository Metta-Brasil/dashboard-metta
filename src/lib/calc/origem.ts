import type { FilterState, OrigemResult, RawData } from "./types";

/**
 * Origem — stub funcional. Lógica completa: PRD §5.2.7.
 */
export function calcOrigem(
  _data: Pick<RawData, "leads" | "sdr" | "vendas">,
  _filters: FilterState
): OrigemResult {
  return { porCategoria: [] };
}
