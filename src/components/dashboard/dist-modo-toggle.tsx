"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented control de seleção única (Vídeo | Seguidores) que sincroniza
 * o param `modo` via URL. Ausência de `modo` ou `modo=seguidores` ⇒
 * "Seguidores"; `modo=video` ⇒ "Vídeo". Mesmo padrão de URL do
 * MultiSelectFilter (router.replace + useSearchParams).
 */

type Modo = "video" | "seguidores";

const OPTIONS: { value: Modo; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "seguidores", label: "Seguidores" },
];

export function DistModoToggle() {
  const router = useRouter();
  const sp = useSearchParams();

  const current: Modo = sp?.get("modo") === "video" ? "video" : "seguidores";

  const select = useCallback(
    (value: Modo) => {
      if (value === current) return;
      const params = new URLSearchParams(sp?.toString() ?? "");
      // Seguidores é o default → não polui a URL com o param.
      if (value === "seguidores") params.delete("modo");
      else params.set("modo", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [current, router, sp]
  );

  return (
    <div
      role="radiogroup"
      aria-label="Funil"
      className="inline-flex h-9 items-center rounded-md border border-input bg-card p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(o.value)}
            className={cn(
              "inline-flex h-full cursor-pointer items-center rounded-[5px] px-3 text-[13px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
