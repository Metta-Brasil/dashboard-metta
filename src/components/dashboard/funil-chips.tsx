"use client";

import { MultiSelectFilter } from "./multi-select-filter";

const FUNIL_OPTIONS = [
  { value: "sala", label: "Sala" },
  { value: "aplica", label: "Aplicação" },
  { value: "sessao", label: "Sessão" },
  { value: "isca", label: "Isca" },
  { value: "reality", label: "Reality" },
];

export function FunilChips() {
  return (
    <MultiSelectFilter
      param="funis"
      label="Funil"
      options={FUNIL_OPTIONS}
      mode="todos"
    />
  );
}
