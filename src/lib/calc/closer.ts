import type { CloserResult, FilterState, RawData } from "./types";

/**
 * Comercial Closer — stub funcional. Lógica completa: PRD §5.2.6.
 */
export function calcCloser(
  _data: Pick<RawData, "sdr" | "vendas">,
  _filters: FilterState
): CloserResult {
  return {
    kpis: {
      reunioes: 0,
      propostas: 0,
      vendas: 0,
      faturamento: 0,
      ticketMedio: 0,
      taxaProposta: 0,
      taxaFechamento: 0,
    },
    porCloser: [],
  };
}
