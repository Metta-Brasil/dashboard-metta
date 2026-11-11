"use client";

import { CONTA_OPTIONS } from "./filter-options";
import { MultiSelectFilter } from "./multi-select-filter";

/**
 * Filtro de Conta (Metta | Tiago) — multiselect simples (param ausente
 * = todas). Trava a página TP Distribuição ao recorte de contas.
 */
export function ContaFilter() {
  return (
    <MultiSelectFilter
      param="conta"
      label="Conta"
      mode="plain"
      options={CONTA_OPTIONS}
    />
  );
}
