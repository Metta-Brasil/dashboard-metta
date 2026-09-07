import { formatInt, formatPercent } from "@/lib/calc/shared";
import type { ResgateFunilEtapa } from "@/lib/calc/types";
import { cn } from "@/lib/utils";

type FunnelHorizontalProps = {
  title?: string;
  description?: string;
  steps: ResgateFunilEtapa[];
  className?: string;
};

function formatDias(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 })}d`;
}

/**
 * Funil horizontal (esquerda → direita): cada etapa é uma coluna e a altura
 * da barra estreita ao longo do eixo, formando a silhueta afunilada.
 *
 * A altura é ESQUEMÁTICA (100% → 40%, distribuída linear), não proporcional
 * ao valor: com base >> venda, as etapas do fim colapsariam num fio. O dado
 * real está no número, na conversão e no rodapé de cada coluna.
 *
 * Cada coluna carrega três leituras distintas, que é o ponto do formato:
 *  - o número grande = quantos PASSARAM pela etapa (cumulativo);
 *  - "N parados · Xd" = quantos estão ali AGORA e há quanto tempo em média;
 *  - "→ N" = quantos seguiram para a etapa seguinte.
 */
export function FunnelHorizontal({
  title,
  description,
  steps,
  className,
}: FunnelHorizontalProps) {
  if (!steps.length) return null;

  const n = steps.length;
  const alturaPct = (i: number) => (n <= 1 ? 100 : 100 - (i / (n - 1)) * 60);

  return (
    <div className={cn("surface-card flex flex-col gap-5 p-5 lg:p-6", className)}>
      {(title || description) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h3 className="panel-title">{title}</h3>}
          {description && <span className="panel-desc">{description}</span>}
        </div>
      )}

      {/* Wide content rola dentro do próprio card: 9 etapas não cabem no
          celular e a página nunca deve rolar na horizontal. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[720px] items-stretch gap-1">
          {steps.map((s, i) => {
            const h = alturaPct(i);
            // Profundidade visual: cada etapa um pouco mais escura.
            const shade = 1 - i * (0.5 / Math.max(n - 1, 1));
            return (
              <div key={s.etapa} className="flex flex-1 flex-col gap-2">
                {/* Barra: altura ∝ taper esquemático, centrada no eixo */}
                <div className="flex h-[150px] items-center">
                  <div
                    className="flex w-full items-center justify-center rounded-md"
                    style={{
                      height: `${h}%`,
                      backgroundColor: `color-mix(in oklab, var(--primary) ${
                        shade * 100
                      }%, transparent)`,
                    }}
                  >
                    <span className="px-1 text-base font-semibold tabular-nums text-foreground">
                      {formatInt(s.valor)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 text-center">
                  <span
                    className="truncate text-xs font-medium text-foreground"
                    title={s.etapa}
                  >
                    {s.etapa}
                  </span>

                  {/* Conversão vinda da etapa anterior */}
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {i === 0 ? "—" : `▼ ${formatPercent(s.conversaoEtapa)}`}
                  </span>

                  {/* Quem está parado aqui agora, e há quanto tempo */}
                  <span
                    className="text-[11px] tabular-nums text-muted-foreground"
                    title="Negócios parados nesta etapa agora · tempo médio desde a última movimentação"
                  >
                    {s.parados > 0
                      ? `${formatInt(s.parados)} parado${s.parados > 1 ? "s" : ""}${
                          s.diasMedia !== null ? ` · ${formatDias(s.diasMedia)}` : ""
                        }`
                      : "—"}
                  </span>

                  {/* Quantos seguiram pro próximo card */}
                  <span
                    className="text-[11px] font-medium tabular-nums text-muted-foreground"
                    title="Negócios que seguiram para a etapa seguinte"
                  >
                    {i === n - 1 ? " " : `→ ${formatInt(s.avancaram)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
