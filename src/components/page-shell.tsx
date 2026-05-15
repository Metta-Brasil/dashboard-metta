import { cn } from "@/lib/utils";

type PageShellProps = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({
  title,
  description,
  toolbar,
  children,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "@container/main flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8",
        className
      )}
    >
      {(title || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            {title && (
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({
  title = "Aguardando conexão de dados",
  description = "Quando o Google Sheets estiver conectado, os dados aparecem aqui automaticamente.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
      <div className="flex max-w-md flex-col items-center gap-2">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value = "—",
  hint,
}: {
  label: string;
  value?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
