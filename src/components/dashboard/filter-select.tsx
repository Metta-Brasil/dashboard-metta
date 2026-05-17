"use client";

import { MultiSelectFilter } from "./multi-select-filter";

type FilterSelectProps = {
  param: string;
  label: string;
  /** Lista de valores (value == label). */
  options: string[];
};

/**
 * Filtro multiselect simples (SDR / Status). Mantém a assinatura legada
 * `{ param, label, options: string[] }` — internamente usa o componente
 * padronizado MultiSelectFilter em modo "plain".
 */
export function FilterSelect({ param, label, options }: FilterSelectProps) {
  return (
    <MultiSelectFilter
      param={param}
      label={label}
      options={options.map((o) => ({ value: o, label: o }))}
      mode="plain"
    />
  );
}
