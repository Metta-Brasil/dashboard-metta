"use client";

import { useState } from "react";

import { deleteAccountAction } from "@/app/(dashboard)/configuracoes/actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-9 w-fit rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        Excluir conta
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-destructive">
        Isso apaga sua conta de e-mail e senha permanentemente. Não dá
        pra desfazer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={deleteAccountAction}>
          <button
            type="submit"
            className="h-9 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            Confirmar exclusão
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
