"use client";

import { useActionState, useState } from "react";

import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/(dashboard)/configuracoes/actions";

const initial: DeleteAccountState = {};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

/**
 * Texto padrão por tipo de conta. Conta Google não tem registro pra
 * apagar aqui: o que some é o overlay de perfil, as sessões caem, e o
 * login pelo Google continua valendo enquanto o e-mail estiver autorizado
 * no domínio. Prometer "exclusão permanente" nesse caso seria mentira.
 */
const DEFAULT_CONFIRM_TEXT = {
  password:
    "Isso apaga sua conta de e-mail e senha permanentemente e encerra suas sessões. Não dá pra desfazer.",
  email:
    "Isso apaga os dados de perfil guardados aqui (nome, foto, telefone, cargo) e encerra suas sessões. Não dá pra desfazer — mas o acesso pelo Google continua enquanto seu e-mail estiver autorizado no domínio.",
} as const;

export function DeleteAccountButton({
  confirmText,
}: {
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initial
  );
  const [dismissed, setDismissed] = useState(false);
  // `useActionState` só troca de valor quando a action responde, então o
  // painel reabria já mostrando o erro da tentativa anterior — antes de
  // qualquer envio novo. Cancelar descarta esse resultado; reabrir limpa a
  // marca; e enquanto o envio está em voo o erro velho fica escondido.
  const [staleError, setStaleError] = useState(false);

  // O primeiro submit não apaga nada: a action responde qual prova a
  // conta exige (senha para e-mail/senha, o próprio e-mail para Google).
  // Só então o painel de confirmação aparece com o campo certo.
  const open = Boolean(state.mode) && !dismissed;
  const askPassword = state.mode === "password";
  const showError = Boolean(state.error) && !staleError && !pending;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {open ? (
        <>
          <p className="text-sm text-destructive">
            {confirmText ??
              DEFAULT_CONFIRM_TEXT[askPassword ? "password" : "email"]}
          </p>

          <div className="flex max-w-sm flex-col gap-1.5">
            <label
              htmlFor="confirmation"
              className="text-xs font-medium text-foreground"
            >
              {askPassword
                ? "Senha atual"
                : "Digite seu e-mail para confirmar"}
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type={askPassword ? "password" : "email"}
              required
              autoComplete={askPassword ? "current-password" : "off"}
              placeholder={askPassword ? undefined : "seu@mettabrasil.com.br"}
              spellCheck={false}
              className={inputCls}
            />
          </div>

          {showError && (
            <p className="max-w-sm rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Excluindo…" : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                setStaleError(true);
              }}
              className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <button
          type="submit"
          disabled={pending}
          onClick={() => {
            setDismissed(false);
            setStaleError(false);
          }}
          className="h-9 w-fit rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
        >
          {pending ? "Aguarde…" : "Excluir conta"}
        </button>
      )}
    </form>
  );
}
