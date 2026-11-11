"use client";

import { useCallback } from "react";

import { cn } from "@/lib/utils";

import { ORIGEM_OPTIONS } from "./filter-options";
import { useUrlState } from "./use-url-state";

/**
 * Segmented control "Todos | Pagos | Orgânicos" das páginas de funil
 * dinâmico. Sincroniza o param `origem` (default = todos, fora da URL) via
 * router.replace, scroll:false — mesmo padrão do SdrDataToggle.
 */

type Origem = (typeof ORIGEM_OPTIONS)[number]["value"];

export function OrigemToggle() {
  const { params: sp, setParams, pending } = useUrlState();

  const raw = sp?.get("origem");
  const current: Origem = raw === "pago" || raw === "organico" ? raw : "todos";

  const select = useCallback(
    (value: Origem) => {
      if (value === current) return;
      setParams((params) => {
        if (value === "todos") params.delete("origem");
        else params.set("origem", value);
      });
    },
    [current, setParams]
  );

  return (
    <div
      role="radiogroup"
      aria-busy={pending || undefined}
      aria-label="Origem do lead"
      className="inline-flex h-9 items-center rounded-md border border-input bg-card p-0.5"
    >
      {ORIGEM_OPTIONS.map((o) => {
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
