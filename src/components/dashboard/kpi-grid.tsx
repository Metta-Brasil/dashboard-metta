import Link from "next/link";

import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
  /**
   * Destino do clique no card (ex.: a lista dos leads por trás do número).
   * Com ele o card inteiro vira link; `active` marca o card cuja lista
   * está aberta.
   */
  href?: string;
  active?: boolean;
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
  cols = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  className,
}: KpiGridProps) {
  return (
    <div className={cn("grid gap-2 sm:gap-3", cols, className)}>
      {kpis.map((k) => {
        const conteudo = (
          <>
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                {k.label}
              </span>
              {k.delta && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ring-1 ring-inset sm:px-2 sm:text-[11px]",
                    DELTA_STYLE[k.delta.direction],
                  )}
                >
                  <span aria-hidden>{DELTA_ARROW[k.delta.direction]}</span>
                  {k.delta.value}
                </span>
              )}
            </div>
            <span className="text-lg font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[28px]">
              {k.value}
            </span>
            {k.hint && (
              <span className="text-[10px] text-muted-foreground sm:text-xs">
                {k.hint}
              </span>
            )}
          </>
        );
        const classe = cn(
          "surface-card surface-card-interactive flex flex-col gap-1.5 p-3 sm:gap-3 sm:p-5",
          k.active && "border-foreground",
        );
        return k.href ? (
          <Link
            key={k.label}
            href={k.href}
            scroll={false}
            aria-current={k.active ? "true" : undefined}
            title="Ver os leads deste número"
            className={cn(
              classe,
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {conteudo}
          </Link>
        ) : (
          <div key={k.label} className={classe}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}
