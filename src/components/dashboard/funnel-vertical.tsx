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
    <div className="surface-card p-5 lg:p-6">
      {(title || description) && (
        <div className="mb-5 flex items-baseline justify-between gap-2">
          {title && <h3 className="panel-title">{title}</h3>}
          {description && <span className="panel-desc">{description}</span>}
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const isMonetario = monetarySet.has(s.etapa);
          const pct = Math.max((s.valor / max) * 100, 3);
          return (
            <div key={s.etapa} className="flex items-center gap-4">
              <div className="w-28 shrink-0 text-sm font-medium text-muted-foreground sm:w-36">
                {s.etapa}
              </div>
              <div className="relative h-10 flex-1 overflow-hidden rounded-lg bg-muted/70">
                <div
                  className="h-full rounded-lg bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end px-3.5">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {isMonetario
                      ? formatBRLCompact(s.valor)
                      : formatInt(s.valor)}
                  </span>
                </div>
              </div>
              <div className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                {i === 0 ? "—" : formatPercent(s.conversaoEtapa)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
