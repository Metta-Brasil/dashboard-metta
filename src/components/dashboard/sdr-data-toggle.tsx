"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented control "Data de agendamento" | "Data de reunião" da tabela
 * Performance por data (SDR). Sincroniza param `sdrDate` (default = agendamento)
 * via router.replace, scroll:false — mesmo padrão do DistModoToggle.
 */

type Modo = "agendamento" | "reuniao";

const OPTIONS: { value: Modo; label: string }[] = [
  { value: "agendamento", label: "Data de agendamento" },
  { value: "reuniao", label: "Data de reunião" },
];

export function SdrDataToggle() {
  const router = useRouter();
  const sp = useSearchParams();

  const current: Modo = sp?.get("sdrDate") === "reuniao" ? "reuniao" : "agendamento";

  const select = useCallback(
    (value: Modo) => {
      if (value === current) return;
      const params = new URLSearchParams(sp?.toString() ?? "");
      // Agendamento é o default → não polui a URL.
      if (value === "agendamento") params.delete("sdrDate");
      else params.set("sdrDate", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [current, router, sp]
  );

  return (
    <div
      role="radiogroup"
      aria-label="Agrupamento por data"
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
