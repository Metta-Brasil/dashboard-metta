"use client";

import { useEffect } from "react";

/**
 * Error boundary das telas de login/cadastro. Mesma lógica de
 * deployment skew do dashboard: aba aberta de um build antigo cujo
 * chunk/Server Action sumiu no deploy novo. Aqui o efeito mais comum
 * é "cliquei e nada acontece" — então em qualquer erro de chunk/skew
 * recarregamos pra pegar o build atual.
 */
const SKEW_RE =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const RELOAD_FLAG = "metta:skew-reload-auth";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isSkew = SKEW_RE.test(`${error?.name} ${error?.message}`);

  useEffect(() => {
    if (!isSkew) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  }, [isSkew]);

  return (
    <div className="surface-card flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/metta-symbol.svg" alt="Metta" className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {isSkew ? "Atualizando…" : "Não foi possível carregar"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isSkew
            ? "Saiu uma versão nova. Recarregando para pegar a atualização."
            : "Foi um problema temporário. Recarregue a página para entrar."}
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
  );
}
