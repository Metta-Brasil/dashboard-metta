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
};

export function MetricTable<T>({
  title,
  description,
  toolbar,
  columns,
  rows,
  footer,
  empty = "Sem dados no período.",
  className,
}: MetricTableProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      {(title || toolbar) && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">
                {description}
              </span>
            )}
          </div>
          {toolbar && (
            <div className="flex items-center gap-2">{toolbar}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 font-medium",
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
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2 tabular-nums",
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
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2 tabular-nums",
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
