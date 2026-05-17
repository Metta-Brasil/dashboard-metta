import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type PageShellProps = {
  title?: string;
  /** Mantido por compat — não é mais renderizado (cabeçalho compacto). */
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({
  title,
  toolbar,
  children,
  className,
}: PageShellProps) {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex w-full items-center gap-2 px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto"
          />
          <h1 className="text-sm font-medium tracking-tight text-foreground">
            {title}
          </h1>
          <div className="flex-1" />
          {toolbar && (
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
              {toolbar}
            </div>
          )}
        </div>
      </header>
      <div
        className={cn(
          "@container/main flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8",
          className
        )}
      >
        {children}
      </div>
    </>
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
    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
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
    <div className="surface-card surface-card-interactive flex flex-col gap-3 p-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
