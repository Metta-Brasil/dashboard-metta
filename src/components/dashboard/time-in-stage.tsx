import { cn } from "@/lib/utils";
import type { TimeInStagePoint } from "@/lib/calc/types";

type TimeInStageProps = {
  points: TimeInStagePoint[];
  title?: string;
  description?: string;
  className?: string;
};

function formatDias(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} d`;
}

/**
 * Funil de Time-in-Stage: cada etapa é uma barra centrada que estreita de
 * cima pra baixo (100% → ~32%), no mesmo padrão visual do FunnelVertical.
 * Métrica principal por etapa = MÉDIA (em destaque); secundária = MEDIANA
 * (escrita por extenso, não abreviada).
 */
export function TimeInStage({
  points,
  title = "Time-in-Stage",
  description = "Tempo médio em cada transição do funil SDR.",
  className,
}: TimeInStageProps) {
  const n = points.length;
  const widthAt = (i: number): number =>
    n <= 1 ? 100 : 100 - (i / (n - 1)) * 68;

  return (
    <div className={cn("surface-card flex flex-col gap-4 p-5 lg:p-6", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="panel-title">{title}</h3>
        <span className="panel-desc">{description}</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        {points.map((p, i) => {
          const pct = widthAt(i);
          // Profundidade visual: cada etapa um pouco mais escura.
          const shade = 1 - i * (0.5 / Math.max(n - 1, 1));
          return (
            <div
              key={p.label}
              className="flex w-full flex-col items-center"
            >
              <div
                className="flex min-h-[68px] flex-col items-stretch gap-1 rounded-lg px-4 py-2.5 transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `color-mix(in srgb, var(--primary) ${
                    shade * 100
                  }%, var(--card))`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-foreground/90 break-words">
                    {p.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] font-light text-foreground/70 tabular-nums">
                    n = {p.n.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="whitespace-nowrap text-lg font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-xl">
                    {formatDias(p.mediaDias)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground/75 tabular-nums">
                    Mediana {formatDias(p.medianaDias)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
