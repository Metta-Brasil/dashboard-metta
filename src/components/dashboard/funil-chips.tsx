"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const FUNIS = [
  { id: "todos", label: "Todos" },
  { id: "sala", label: "Sala" },
  { id: "aplica", label: "Aplicação" },
  { id: "sessao", label: "Sessão" },
  { id: "isca", label: "Isca" },
  { id: "reality", label: "Reality" },
] as const;

type FunilId = (typeof FUNIS)[number]["id"];

function parseSelected(raw: string | null): Set<FunilId> {
  if (!raw) return new Set(["todos"]);
  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is FunilId => FUNIS.some((f) => f.id === t));
  return tokens.length ? new Set(tokens) : new Set(["todos"]);
}

export function FunilChips() {
  const router = useRouter();
  const sp = useSearchParams();
  const selected = parseSelected(sp?.get("funis") ?? null);

  function toggle(id: FunilId) {
    const next = new Set(selected);
    if (id === "todos") {
      next.clear();
      next.add("todos");
    } else {
      next.delete("todos");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("todos");
    }
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (next.has("todos")) params.delete("funis");
    else params.set("funis", Array.from(next).join(","));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {FUNIS.map((f) => {
        const active = selected.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => toggle(f.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
