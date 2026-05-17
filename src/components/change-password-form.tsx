"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  type ChangePwState,
} from "@/app/(dashboard)/configuracoes/actions";

const initial: ChangePwState = {};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="current" className="text-xs font-medium text-foreground">
          Senha atual
        </label>
        <input
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="next" className="text-xs font-medium text-foreground">
          Nova senha
        </label>
        <input
          id="next"
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm"
          className="text-xs font-medium text-foreground"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </div>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Senha alterada com sucesso.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-9 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}
