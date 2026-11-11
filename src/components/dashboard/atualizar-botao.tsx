"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

const TZ = "America/Sao_Paulo";
const hora = (ts: number) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(ts)
  );
const dataHora = (ts: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(ts));

/** `ts` = último refresh do cache (ms). 0 = nunca rodou. */
export function AtualizarBotao({ ts }: { ts: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = () =>
    startTransition(async () => {
      setErro(null);
      try {
        const resp = await fetch("/api/atualizar", { method: "POST" });
        const r = (await resp.json().catch(() => null)) as
          | { ok: boolean; error?: string }
          | null;
        if (resp.ok && r?.ok) router.refresh();
        else setErro(r?.error ?? "Não foi possível atualizar agora.");
      } catch {
        setErro("Sem conexão para atualizar.");
      }
    });

  const texto = pending
    ? "Atualizando…"
    : erro
      ? erro
      : ts > 0
        ? `Atualizado ${hora(ts)}`
        : "Sem atualização";

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={atualizar}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-label="Atualizar os dados agora"
        title="Reler as planilhas agora"
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
      >
        <RefreshCwIcon aria-hidden className={cn("size-3.5", pending && "animate-spin")} />
      </button>
      <span
        role="status"
        title={ts > 0 ? `O dashboard leu as planilhas em ${dataHora(ts)}` : undefined}
        className={cn(
          "text-[11px] tabular-nums",
          erro && !pending ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {texto}
      </span>
    </span>
  );
}
