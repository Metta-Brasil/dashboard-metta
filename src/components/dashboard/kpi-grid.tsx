import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
};

type KpiGridProps = {
  kpis: Kpi[];
  /** Tailwind cols spec — default 5 cols. */
  cols?: string;
  className?: string;
};

const DELTA_STYLE: Record<"up" | "down" | "neutral", string> = {
  up: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  down: "bg-rose-50 text-rose-700 ring-rose-600/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const DELTA_ARROW: Record<"up" | "down" | "neutral", string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export function KpiGrid({
  kpis,
  cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  className,
}: KpiGridProps) {
  return (
    <div className={cn("grid gap-3", cols, className)}>
      {kpis.map((k) => (
        <div
          key={k.label}
          className="surface-card surface-card-interactive flex flex-col gap-3 p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {k.label}
            </span>
            {k.delta && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset",
                  DELTA_STYLE[k.delta.direction]
                )}
              >
                <span aria-hidden>{DELTA_ARROW[k.delta.direction]}</span>
                {k.delta.value}
              </span>
            )}
          </div>
          <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {k.value}
          </span>
          {k.hint && (
            <span className="text-xs text-muted-foreground">{k.hint}</span>
          )}
        </div>
      ))}
    </div>
  );
}
