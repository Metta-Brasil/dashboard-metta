"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented control (Metta | Tiago) que sincroniza o param `conta` via URL.
 * Ausência de `conta` ou `conta=metta` ⇒ "Metta"; `conta=tiago` ⇒ "Tiago".
 * Mesmo padrão do DistModoToggle.
 */

type Conta = "metta" | "tiago";

const OPTIONS: { value: Conta; label: string }[] = [
  { value: "metta", label: "Metta" },
  { value: "tiago", label: "Tiago" },
];

export function IgContaToggle() {
  const router = useRouter();
  const sp = useSearchParams();

  const current: Conta = sp?.get("conta") === "tiago" ? "tiago" : "metta";

  const select = useCallback(
    (value: Conta) => {
      if (value === current) return;
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (value === "metta") params.delete("conta");
      else params.set("conta", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [current, router, sp]
  );

  return (
    <div
      role="radiogroup"
      aria-label="Conta Instagram"
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
