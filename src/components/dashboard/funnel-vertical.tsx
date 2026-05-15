import { formatBRLCompact, formatInt, formatPercent } from "@/lib/calc/shared";
import type { FunnelStep } from "@/lib/calc/types";

type FunnelVerticalProps = {
  title?: string;
  description?: string;
  steps: FunnelStep[];
  /** Etapas tratadas como monetárias (Investimento, Faturamento, etc.) */
  monetaryEtapas?: string[];
};

export function FunnelVertical({
  title,
  description,
  steps,
  monetaryEtapas = ["Investimento", "Faturamento"],
}: FunnelVerticalProps) {
  if (!steps.length) return null;
  const max = steps[0]?.valor || 1;
  const monetarySet = new Set(monetaryEtapas);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      {(title || description) && (
        <div className="mb-4 flex items-baseline justify-between">
          {title && (
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const isMonetario = monetarySet.has(s.etapa);
          const pct = Math.max((s.valor / max) * 100, 2);
          return (
            <div key={s.etapa} className="flex items-center gap-4">
              <div className="w-32 shrink-0 text-sm text-muted-foreground">
                {s.etapa}
              </div>
              <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full bg-primary/80 transition-all"
                  style={{ width: `${pct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end px-3">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {isMonetario
                      ? formatBRLCompact(s.valor)
                      : formatInt(s.valor)}
                  </span>
                </div>
              </div>
              <div className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {i === 0 ? "—" : formatPercent(s.conversaoEtapa)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
