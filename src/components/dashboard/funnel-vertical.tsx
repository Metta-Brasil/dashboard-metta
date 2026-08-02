import { formatBRLCompact, formatInt, formatPercent } from "@/lib/calc/shared";
import type { FunnelStep } from "@/lib/calc/types";
import { cn } from "@/lib/utils";

type FunnelVerticalProps = {
  title?: string;
  description?: string;
  steps: FunnelStep[];
  /** Etapas tratadas como monetárias (Investimento, Faturamento, etc.) */
  monetaryEtapas?: string[];
  /** Larguras (%) por etapa — sobrepõe o taper esquemático padrão. */
  widths?: number[];
  className?: string;
};

/**
 * Funil de verdade: barras CENTRADAS que estreitam etapa a etapa
 * (largura ∝ valor/topo), formando a silhueta afunilada. Entre as
 * etapas, um chip central mostra a conversão (queda) daquela passagem.
 */
export function FunnelVertical({
  title,
  description,
  steps,
  monetaryEtapas = ["Investimento", "Faturamento"],
  widths,
  className,
}: FunnelVerticalProps) {
  if (!steps.length) return null;
  const monetarySet = new Set(monetaryEtapas);
  // Taper ESQUEMÁTICO: cada etapa estritamente mais estreita que a
  // anterior, de 100% até ~32%. Valor proporcional ao topo colapsaria
  // as etapas baixas (vendas << investimento) num bloco indistinto —
  // a silhueta afunilada é esquemática; o dado real é o número/%.
  const n = steps.length;
  // Larguras esquemáticas: 100, 85, e depois -15 por etapa (70, 55, 40, …),
  // com piso pra não sumir em funis longos. `widths` sobrepõe por etapa.
  const widthAt = (i: number) =>
    widths?.[i] ?? (i === 0 ? 100 : Math.max(85 - (i - 1) * 15, 20));

  return (
    <div className={cn("surface-card p-5 lg:p-6", className)}>
      {(title || description) && (
        <div className="mb-5 flex items-baseline justify-between gap-2">
          {title && <h3 className="panel-title">{title}</h3>}
          {description && <span className="panel-desc">{description}</span>}
        </div>
      )}

      <div className="flex flex-col items-center">
        {steps.map((s, i) => {
          const isMonetario = monetarySet.has(s.etapa);
          const pct = widthAt(i);
          // Profundidade visual: cada degrau um pouco mais escuro.
          const shade = 1 - i * (0.5 / Math.max(n - 1, 1));

          return (
            <div key={s.etapa} className="flex w-full flex-col items-center">
              {i > 0 && (
                <div className="flex items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground">
                  <span aria-hidden className="text-[10px]">
                    ▼
                  </span>
                  <span className="tabular-nums">
                    {formatPercent(s.conversaoEtapa)}
                  </span>
                </div>
              )}
              <div
                className="flex h-12 items-center justify-between gap-3 rounded-lg px-4 transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `color-mix(in srgb, var(--primary) ${
                    shade * 100
                  }%, var(--card))`,
                }}
              >
                <span className="truncate text-sm font-semibold text-foreground">
                  {s.etapa}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {isMonetario
                    ? formatBRLCompact(s.valor)
                    : formatInt(s.valor)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
