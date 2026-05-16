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

  useEffect(() => {
    // Diagnóstico temporário: superfície o erro real no console.
    console.error("[dashboard/error]", error?.name, error?.message, error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
      <div className="surface-card flex max-w-md flex-col items-center gap-5 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/metta-symbol.svg" alt="Metta" className="size-6" />
        </span>
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
        <p className="max-w-full break-words rounded-md bg-muted px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">
          <strong>{error?.name || "Error"}</strong>: {error?.message || "(sem mensagem)"}
          {error?.digest ? ` · ref ${error.digest}` : ""}
        </p>
      </div>
    </div>
  );
}
