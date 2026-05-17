import {
  confirmEmailChangeAction,
  requestEmailChangeAction,
  resendEmailChangeAction,
} from "@/app/(dashboard)/configuracoes/actions";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

export function EmailChange({
  currentEmail,
  pendingNewEmail,
  error,
  sent,
}: {
  currentEmail: string;
  pendingNewEmail?: string;
  error?: string;
  sent?: boolean;
}) {
  if (pendingNewEmail) {
    return (
      <div className="flex max-w-md flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">
            Confirme o novo e-mail
          </span>
          <span className="text-[11px] text-muted-foreground">
            Enviamos um código de 6 dígitos para{" "}
            <span className="font-medium text-foreground">
              {pendingNewEmail}
            </span>
            . Ele expira em 15 minutos.
          </span>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {sent && !error && (
          <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
            Código reenviado.
          </p>
        )}

        <form action={confirmEmailChangeAction} className="flex flex-col gap-3">
          <input type="hidden" name="newEmail" value={pendingNewEmail} />
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            required
            className={inputCls}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              Confirmar novo e-mail
            </button>
          </div>
        </form>

        <form action={resendEmailChangeAction}>
          <button
            type="submit"
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Reenviar código
          </button>
        </form>
      </div>
    );
  }

  return (
    <details className="border-t border-border pt-4">
      <summary className="cursor-pointer text-xs font-medium text-foreground">
        Alterar e-mail
      </summary>
      <div className="mt-3 flex max-w-md flex-col gap-3">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Enviaremos um código para o novo e-mail. Ao confirmar, você
          precisará entrar de novo com ele. E-mail atual:{" "}
          <span className="font-medium text-foreground">{currentEmail}</span>.
        </p>
        <form
          action={requestEmailChangeAction}
          className="flex flex-col gap-3"
        >
          <input
            name="newEmail"
            type="email"
            placeholder="novo@mettabrasil.com.br"
            required
            className={inputCls}
          />
          <button
            type="submit"
            className="h-9 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            Enviar código de confirmação
          </button>
        </form>
      </div>
    </details>
  );
}
