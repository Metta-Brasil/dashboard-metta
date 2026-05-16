"use client";

import { useEffect } from "react";

/**
 * Error boundary do dashboard. Erros transitórios de navegação —
 * principalmente "deployment skew" (aba aberta de um build antigo
 * pedindo um chunk que o novo deploy não tem mais) — caíam na tela
 * preta default do Next, sem idioma e sem recuperação. Aqui:
 * - chunk/deploy skew → recarrega a página automaticamente (pega o
 *   build novo), só uma vez pra não entrar em loop.
 * - demais erros → card de marca em PT-BR com "tentar de novo".
 */
const SKEW_RE =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const RELOAD_FLAG = "metta:skew-reload";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isSkew = SKEW_RE.test(`${error?.name} ${error?.message}`);

  useEffect(() => {
    if (!isSkew) return;
    // Só recarrega uma vez por sessão de erro — evita loop se o
    // problema persistir após o reload.
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  }, [isSkew]);

  useEffect(() => {
    if (!isSkew) sessionStorage.removeItem(RELOAD_FLAG);
  }, [isSkew]);

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
      <div className="surface-card flex max-w-md flex-col items-center gap-5 p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/metta-symbol.svg" alt="Metta" className="size-10" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">
            {isSkew
              ? "Atualizando o dashboard…"
              : "Algo não carregou nesta página"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSkew
              ? "Saiu uma versão nova enquanto você estava aqui. Recarregando para pegar a atualização."
              : "Foi um problema temporário ao montar a página. Tente de novo — seus dados estão intactos."}
          </p>
        </div>
        {!isSkew && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Recarregar página
            </button>
          </div>
        )}
        {error?.digest && (
          <p className="text-[11px] text-muted-foreground/70">
            Ref. {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
