import { DateRangePopover } from "./date-range-popover";
import { FunilChips } from "./funil-chips";

type ToolbarProps = {
  from: Date;
  to: Date;
  /** Mostrar funil chips? Default true */
  funil?: boolean;
  /** Filtros extras (à direita) */
  extras?: React.ReactNode;
  /** Filtros extras à esquerda, logo depois do funil. */
  leftExtras?: React.ReactNode;
};

export function Toolbar({
  from,
  to,
  funil = true,
  extras,
  leftExtras,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {funil && <FunilChips />}
        {leftExtras}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extras}
        <DateRangePopover from={from} to={to} />
      </div>
    </div>
  );
}
