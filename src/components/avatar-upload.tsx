"use client";

import { useActionState, useRef, useState } from "react";
import { CameraIcon } from "lucide-react";

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

        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            aria-label="Trocar foto de perfil"
            className="group relative size-16 shrink-0 overflow-hidden rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
          >
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown}
                alt="Foto de perfil"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center bg-muted text-lg font-semibold text-muted-foreground">
                {initialChar}
              </span>
            )}

            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <CameraIcon className="size-4" />
              <span className="text-[10px] font-medium leading-none">
                {pending ? "Salvando…" : "Trocar"}
              </span>
            </span>

            {pending && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              </span>
            )}
          </button>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Conta de e-mail e senha. Acesso restrito ao domínio
              @mettabrasil.com.br.
            </span>
            <span className="text-[11px] text-muted-foreground">
              Clique na foto para trocar.
              {(current || preview) && !removing && (
                <>
                  {" · "}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onRemove}
                    className="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    Remover foto
                  </button>
                </>
              )}
            </span>
          </div>
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
