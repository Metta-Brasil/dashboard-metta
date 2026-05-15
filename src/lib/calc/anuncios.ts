import type { AnunciosResult, FilterState, RawData } from "./types";

/**
 * Anúncios — stub funcional. Lógica completa: PRD §5.2.4.
 */
export function calcAnuncios(
  _data: Pick<RawData, "fb_todos" | "leads" | "vendas">,
  _filters: FilterState
): AnunciosResult {
  return { topRoas: [], galeria: [] };
}
