"use client";

import { FUNIL_OPTIONS } from "./filter-options";
import { MultiSelectFilter } from "./multi-select-filter";


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
