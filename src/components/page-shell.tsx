import { Suspense } from "react";

import { Atualizado, AtualizadoFallback } from "@/components/dashboard/atualizado";
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
      {/* z-40 e não z-20: as tabelas têm cabeçalho e primeira coluna
          fixos (até z-30 em metric-table-interactive). Com o header da
          página empatado em z-20, a célula fixa da tabela vencia o
          empate e era desenhada POR CIMA dos filtros — visível no
          celular, onde tudo divide a mesma faixa de tela. Fica abaixo
          dos overlays (popover/dropdown/sheet em z-50), então os
          dropdowns dos filtros continuam por cima do header. */}
      {/* `min-h`, não `h`: com muitos filtros a barra quebra em outra
          linha, e altura travada empurrava os controles para fora da
          borda do cabeçalho. */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex w-full flex-col gap-2 px-4 py-2.5 sm:min-h-(--header-height) sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 h-4 data-vertical:self-auto"
            />
            <h1 className="text-sm font-medium tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          {/* `ml-auto`, não espaçador `flex-1`: o espaçador roubava uma
              linha inteira quando a barra quebrava. */}
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
            {toolbar && (
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                {toolbar}
              </div>
            )}
            {/* Lê o Upstash: suspende sozinho, o resto do cabeçalho não espera. */}
            <Suspense fallback={<AtualizadoFallback />}>
              <Atualizado />
            </Suspense>
          </div>
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
