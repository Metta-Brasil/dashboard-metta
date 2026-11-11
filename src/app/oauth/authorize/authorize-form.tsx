"use client";

import { useActionState, useEffect } from "react";

import { authorizeAction, type AuthorizeState } from "./actions";

const initial: AuthorizeState = {};

export function AuthorizeForm({
  clientId,
  redirectUri,
  codeChallenge,
  state,
}: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}) {
  const [result, formAction, pending] = useActionState(
    authorizeAction,
    initial
  );

  // Volta ao cliente por script (ver comentário da action sobre a CSP).
  useEffect(() => {
    if (result.redirectTo) window.location.assign(result.redirectTo);
  }, [result.redirectTo]);

  const done = Boolean(result.redirectTo);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="state" value={state} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="key" className="text-xs font-medium text-foreground">
          Chave MCP
        </label>
        <input
          id="key"
          name="key"
          type="password"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="mcpk_…"
          className="h-9 w-full rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary"
        />
      </div>

      {result.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      )}
      {done && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          Autorizado. Voltando para o cliente…
        </p>
      )}

      <button
        type="submit"
        disabled={pending || done}
        className="h-9 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Conferindo…" : "Autorizar"}
      </button>
    </form>
  );
}
