"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";
import { MultiSelectFilter } from "./multi-select-filter";

/**
 * Filtro "Tags Clint" — multiselect das tags do CRM com um seletor de modo
 * no topo do dropdown:
 *  - Remover (default): tira do dashboard os negócios que têm as tags
 *    marcadas. É o caso de uso real — importações em massa entram com uma
 *    tag própria e distorcem o volume.
 *  - Somente: mantém só os negócios que têm as tags marcadas.
 *
 * Um controle só em vez de dois filtros concorrentes: com "adicionar" e
 * "remover" separados dava pra marcar a mesma tag nos dois e o resultado
 * ficava indefinido.
 */

export type TagOption = { value: string; label: string };

type Modo = "remover" | "somente";

const MODOS: { value: Modo; label: string }[] = [
  { value: "remover", label: "Remover" },
  { value: "somente", label: "Somente" },
];

function TagsModeToggle() {
  const router = useRouter();
  const sp = useSearchParams();
  const current: Modo = sp?.get("tagsMode") === "somente" ? "somente" : "remover";

  const select = useCallback(
    (value: Modo) => {
      if (value === current) return;
      const params = new URLSearchParams(sp?.toString() ?? "");
      // "remover" é o default → não polui a URL.
      if (value === "remover") params.delete("tagsMode");
      else params.set("tagsMode", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [current, router, sp]
  );

  return (
    <div
      role="radiogroup"
      aria-label="Modo do filtro de tags"
      className="inline-flex h-8 w-full items-center rounded-md border border-input bg-background p-0.5"
    >
      {MODOS.map((m) => {
        const active = m.value === current;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(m.value)}
            className={cn(
              "inline-flex h-full flex-1 cursor-pointer items-center justify-center rounded-[5px] text-[12px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagsClintFilter({ options }: { options: TagOption[] }) {
  const sp = useSearchParams();
  const somente = sp?.get("tagsMode") === "somente";
  const ativo = (sp?.get("tags") ?? "").trim() !== "";

  // O modo só aparece no trigger quando há tag marcada — sem seleção ele
  // não faz nada e a informação seria ruído.
  const label = !ativo
    ? "Tags Clint"
    : somente
      ? "Tags Clint · somente"
      : "Tags Clint · removendo";

  return (
    <MultiSelectFilter
      param="tags"
      label={label}
      options={options}
      mode="plain"
      header={<TagsModeToggle />}
    />
  );
}
