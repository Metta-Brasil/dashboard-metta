import type { FilterState, RawData, SDRResult } from "./types";

/**
 * Comercial SDR — stub funcional. Lógica completa: PRD §5.2.3.
 */
export function calcSdr(
  _data: Pick<RawData, "leads" | "sdr">,
  _filters: FilterState
): SDRResult {
  return {
    kpis: {
      leadsRecebidos: 0,
      tentativasContato: 0,
      agendamentos: 0,
      reunioes: 0,
      taxaContato: 0,
      taxaAgendamento: 0,
      taxaShow: 0,
    },
    heatmap: [],
    porSdr: [],
  };
}
