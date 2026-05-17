"use client";

import { useActionState, useRef, useState } from "react";

import {
  updateAvatarAction,
  type AvatarState,
} from "@/app/(dashboard)/configuracoes/actions";

const initial: AvatarState = {};

const MAX_DIM = 256;

export function AvatarUpload({
  current,
  initial: initialChar,
}: {
  current?: string;
  initial: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateAvatarAction,
    initial
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const shown = removing ? null : preview ?? current ?? null;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Selecione um arquivo de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height >= width && height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setLocalError("Não foi possível processar a imagem.");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        if (dataUrl.length > 200000) {
          setLocalError("Imagem muito grande (máx ~150KB).");
          return;
        }
        setRemoving(false);
        setPreview(dataUrl);
        if (dataRef.current) dataRef.current.value = dataUrl;
        if (removeRef.current) removeRef.current.value = "";
        formRef.current?.requestSubmit();
      };
      img.onerror = () => setLocalError("Imagem inválida.");
      img.src = String(reader.result);
    };
    reader.onerror = () => setLocalError("Falha ao ler o arquivo.");
    reader.readAsDataURL(file);
  }

  function onRemove() {
    setLocalError(null);
    setRemoving(true);
    setPreview(null);
    if (dataRef.current) dataRef.current.value = "";
    if (removeRef.current) removeRef.current.value = "1";
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt="Foto de perfil"
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initialChar}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Conta de e-mail e senha. Acesso restrito ao domínio
          @mettabrasil.com.br.
        </span>
      </div>

      <form action={formAction} ref={formRef}>
        <input ref={dataRef} type="hidden" name="avatar" />
        <input ref={removeRef} type="hidden" name="remove" />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="h-9 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Trocar foto"}
          </button>
          {(current || preview) && !removing && (
            <button
              type="button"
              disabled={pending}
              onClick={onRemove}
              className="h-9 w-fit rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              Remover foto
            </button>
          )}
        </div>
      </form>

      {(localError || state.error) && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localError ?? state.error}
        </p>
      )}
      {state.ok && !localError && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Foto atualizada.
        </p>
      )}
    </div>
  );
}
