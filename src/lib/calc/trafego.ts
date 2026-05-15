import type { FilterState, RawData, TrafegoResult } from "./types";

/**
 * Tráfego Pago — stub funcional. Lógica completa: PRD §5.2.2.
 */
export function calcTrafego(
  _data: Pick<RawData, "fb_todos" | "leads">,
  _filters: FilterState
): TrafegoResult {
  return {
    kpis: { investimento: 0, impressoes: 0, cliques: 0, ctr: 0, cpc: 0, cpm: 0, mql: 0, cmql: 0 },
    serieCombo: [],
    ranking: [],
    funilTrafego: [],
  };
}
