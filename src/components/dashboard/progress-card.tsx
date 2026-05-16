import { cn } from "@/lib/utils";

/**
 * Card-gauge do wireframe #p6: título (+ rótulo de meta), valor grande
 * (real / meta), sub opcional, barra de progresso e rodapé
 * (status à esquerda, gap à direita). `warn` = atenção (azul-acinzentado).
 */
export function ProgressStatCard({
  title,
  metaLabel,
  value,
  metaValue,
  sub,
  pct,
  warn = false,
  footerLeft,
  footerRight,
}: {
  title: string;
  metaLabel?: string;
  value: string;
  metaValue?: string;
  sub?: string;
  /** 0..1 */
  pct: number;
  warn?: boolean;
  footerLeft: string;
  footerRight?: string;
}) {
  const width = `${Math.min(Math.max(pct, 0), 1) * 100}%`;
  return (
    <div className="surface-card flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="panel-title">{title}</h3>
        {metaLabel && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {metaLabel}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </span>
          {metaValue && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {metaValue}
            </span>
          )}
        </div>
        {sub && (
          <span className="text-xs text-muted-foreground">{sub}</span>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              warn ? "bg-[var(--chart-2)]" : "bg-primary"
            )}
            style={{ width }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">{footerLeft}</span>
          {footerRight && (
            <span className="text-muted-foreground">{footerRight}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Bloco "Pacing" do #p6: linhas com label + valor e uma barra de
 * progresso (quanto já avançou da meta).
 */
export function PacingBars({
  title,
  description,
  rows,
}: {
  title: string;
  description?: string;
  rows: { label: string; value: string; pct: number }[];
}) {
  return (
    <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="panel-title">{title}</h3>
        {description && <span className="panel-desc">{description}</span>}
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {r.value}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(Math.max(r.pct, 0), 1) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
