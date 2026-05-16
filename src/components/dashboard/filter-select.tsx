"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Select de filtro genérico (Período/Funil já são outros componentes).
 * Escreve `?<param>=<valor>` na URL; "todos" remove o param.
 * Native <select> de propósito — leve, acessível, sem estado controlado.
 */
export function FilterSelect({
  param,
  label,
  options,
  allLabel = "Todos",
  className,
}: {
  param: string;
  label: string;
  options: string[];
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp?.get(param) ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (!value) params.delete(param);
    else params.set(param, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <label className={cn("flex items-center gap-2 text-xs", className)}>
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:border-ring"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
