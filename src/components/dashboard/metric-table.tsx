import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

type MetricTableProps<T> = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  footer?: T;
  empty?: string;
  className?: string;
  /** Acima de N linhas, limita a altura a ~N linhas e ativa scroll
   *  vertical (cabeçalho e linha TOTAL ficam fixos). */
  maxRows?: number;
};

/** Altura aproximada de uma linha (px-3 py-2.5 + text-sm + borda). */
const ROW_REM = 2.6;

export function MetricTable<T>({
  title,
  description,
  toolbar,
  columns,
  rows,
  footer,
  empty = "Sem dados no período.",
  className,
  maxRows,
}: MetricTableProps<T>) {
  const scrollable = maxRows != null && rows.length > maxRows;

  return (
    <div
      className={cn("surface-card flex flex-col gap-4 p-5 lg:p-6", className)}
    >
      {(title || toolbar) && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-col gap-1">
            {title && <h3 className="panel-title">{title}</h3>}
            {description && <span className="panel-desc">{description}</span>}
          </div>
          {toolbar && (
            <div className="flex items-center gap-2">{toolbar}</div>
          )}
        </div>
      )}

      <div
        className={cn(
          "-mx-2 overflow-x-auto",
          scrollable && "overflow-y-auto"
        )}
        style={
          scrollable
            ? { maxHeight: `calc(${maxRows} * ${ROW_REM}rem + 3rem)` }
            : undefined
        }
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "border-b border-border px-3 py-2.5 font-medium first:rounded-l-md last:rounded-r-md",
                    scrollable
                      ? "sticky top-0 z-20 bg-muted"
                      : "bg-muted/40",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  className="group transition-colors hover:bg-accent/60"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-border/50 px-3 py-2.5 tabular-nums text-foreground/90 group-last:border-b-0",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className
                      )}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {footer && (
              <tr className="font-semibold text-foreground">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "border-t-2 border-border px-3 py-2.5 tabular-nums first:rounded-bl-md last:rounded-br-md",
                      scrollable
                        ? "sticky bottom-0 z-20 bg-muted"
                        : "bg-muted/50",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className
                    )}
                  >
                    {c.render(footer)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
