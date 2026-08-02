import { formatInt } from "@/lib/calc/shared";
import { cn } from "@/lib/utils";

type BarListProps = {
  title: string;
  description?: string;
  data: { name: string; value: number }[];
  className?: string;
};

/**
 * Ranking em barras horizontais (largura ∝ valor sobre o maior).
 * Usado para distribuições com muitas categorias e rótulos longos
 * (ex: subsegmentos), onde barras verticais cortariam o texto.
 */
export function BarList({ title, description, data, className }: BarListProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("surface-card flex flex-col p-5 lg:p-6", className)}>
      <div className="mb-5 flex items-baseline justify-between gap-2">
        <h3 className="panel-title">{title}</h3>
        {description && <span className="panel-desc">{description}</span>}
      </div>
      {data.length === 0 ? (
        <p className="panel-desc">Sem dados no período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((d) => (
            <div key={d.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-foreground">{d.name}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatInt(d.value)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
