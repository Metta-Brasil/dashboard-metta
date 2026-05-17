"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function describe(selected: Set<FunilId>): string {
  if (selected.has("todos")) return "Todos os funis";
  const labels = FUNIS.filter(
    (f) => f.id !== "todos" && selected.has(f.id)
  ).map((f) => f.label);
  if (labels.length === 0) return "Todos os funis";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return labels.join(", ");
  return `${labels.length} funis`;
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
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {describe(selected)}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44">
        {FUNIS.map((f) => (
          <DropdownMenuCheckboxItem
            key={f.id}
            checked={selected.has(f.id)}
            onCheckedChange={() => toggle(f.id)}
          >
            {f.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
