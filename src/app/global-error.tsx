"use client";

import { useEffect } from "react";

/**
 * Último anteparo: erro no próprio root layout. O Next substitui o
 * documento inteiro, então renderizamos <html>/<body> próprios.
 * Mesma lógica de deployment skew do error.tsx do dashboard.
 */
const SKEW_RE =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const RELOAD_FLAG = "metta:skew-reload-global";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isSkew = SKEW_RE.test(`${error?.name} ${error?.message}`);

  useEffect(() => {
    if (!isSkew) return;
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  }, [isSkew]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c161b",
          color: "#eef2f5",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/metta-symbol.svg"
            alt="Metta"
            style={{ width: 40, height: 40 }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {isSkew
              ? "Atualizando o dashboard…"
              : "O dashboard encontrou um erro"}
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              margin: 0,
              color: "rgba(238,242,245,0.7)",
            }}
          >
            {isSkew
              ? "Saiu uma versão nova. Recarregando para pegar a atualização."
              : "Foi um problema temporário. Recarregue a página para continuar."}
          </p>
          {!isSkew && (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ffbe18",
                  color: "#0c161b",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(238,242,245,0.2)",
                  background: "transparent",
                  color: "#eef2f5",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Recarregar página
              </button>
            </div>
          )}
          {error?.digest && (
            <p
              style={{
                fontSize: 11,
                margin: 0,
                color: "rgba(238,242,245,0.45)",
              }}
            >
              Ref. {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
