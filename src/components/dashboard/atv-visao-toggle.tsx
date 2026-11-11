"use client";

import { useCallback } from "react";

import { ATV_VISOES, parseAtvVisao, type AtvVisao } from "@/lib/calc/atividades";
import { cn } from "@/lib/utils";
import { useUrlState } from "./use-url-state";

/**
 * Seletor de pipeline da página Comercial Atividades (Todas | Perpétuo |
 * Resgate | Consultoria), sincronizado no param `pipeline` da URL. Mesmo
 * padrão do DistModoToggle. Ao trocar de pipeline, os filtros de pessoa e
 * canal são limpos: as opções mudam de uma pipeline para outra e um valor
 * que não existe na nova deixaria a página zerada sem explicação.
 */
export function AtvVisaoToggle() {
  const { params: sp, setParams, pending } = useUrlState();
  const current = parseAtvVisao(sp?.get("pipeline"));

  const select = useCallback(
    (value: AtvVisao) => {
      if (value === current) return;
      setParams((params) => {
        if (value === "todas") params.delete("pipeline");
        else params.set("pipeline", value);
        params.delete("pessoa");
        params.delete("canal");
      });
    },
    [current, setParams]
  );

  return (
    <div
      role="radiogroup"
      aria-busy={pending || undefined}
      aria-label="Pipeline"
      className="inline-flex h-9 items-center rounded-md border border-input bg-card p-0.5"
    >
      {ATV_VISOES.map((o) => {
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
