import { DateRangePopover } from "./date-range-popover";
import { FunilChips } from "./funil-chips";

type ToolbarProps = {
  from: Date;
  to: Date;
  /** Mostrar funil chips? Default true */
  funil?: boolean;
  /** Filtros extras (à direita) */
  extras?: React.ReactNode;
};

export function Toolbar({ from, to, funil = true, extras }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {funil && <FunilChips />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extras}
        <DateRangePopover from={from} to={to} />
      </div>
    </div>
  );
}
