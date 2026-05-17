"use client";

import { useActionState } from "react";

import {
  updateProfileAction,
  type ProfileState,
} from "@/app/(dashboard)/configuracoes/actions";

const initial: ProfileState = {};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

export function ProfileForm({
  name,
  email,
  phone,
  role,
}: {
  name: string;
  email: string;
  phone?: string;
  role?: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initial
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-foreground">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-foreground">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className={inputCls}
        />
        <span className="text-[11px] text-muted-foreground">
          Para trocar o e-mail use &ldquo;Alterar e-mail&rdquo; abaixo —
          exige confirmar um código no novo endereço.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-xs font-medium text-foreground"
          >
            Telefone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="(11) 99999-9999"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="role"
            className="text-xs font-medium text-foreground"
          >
            Cargo
          </label>
          <input
            id="role"
            name="role"
            type="text"
            defaultValue={role ?? ""}
            placeholder="Ex: Head de Marketing"
            className={inputCls}
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Perfil atualizado.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-9 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
