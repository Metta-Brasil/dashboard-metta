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
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {k.label}
          </span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {k.value}
          </span>
          {(k.hint || k.delta) && (
            <div className="flex items-center gap-2 text-xs">
              {k.delta && (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    k.delta.direction === "up" && "text-emerald-600",
                    k.delta.direction === "down" && "text-rose-600",
                    k.delta.direction === "neutral" && "text-muted-foreground"
                  )}
                >
                  {k.delta.direction === "up" && "↑ "}
                  {k.delta.direction === "down" && "↓ "}
                  {k.delta.value}
                </span>
              )}
              {k.hint && (
                <span className="text-muted-foreground">{k.hint}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
