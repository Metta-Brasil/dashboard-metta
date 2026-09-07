"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

type MultiSelectFilterProps = {
  /** Search param que serializa a seleção (ex: "funis", "sdr", "status"). */
  param: string;
  /** Texto fixo do trigger (NÃO muda com a seleção). */
  label: string;
  options: MultiSelectOption[];
  /**
   * - "todos": inclui opção "Todos" no topo; param ausente == Todos.
   * - "plain": multiselect simples; param ausente == nada selecionado.
   */
  mode?: "todos" | "plain";
  /** Bloco fixo no topo do dropdown (ex: toggle de modo). Opcional. */
  header?: React.ReactNode;
};

const TODOS_VALUE = "todos";

export function MultiSelectFilter({
  param,
  label,
  options,
  mode = "plain",
  header,
}: MultiSelectFilterProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const raw = sp?.get(param) ?? null;

  const selected = useMemo(() => {
    const valid = new Set(options.map((o) => o.value));
    if (!raw) return new Set<string>();
    return new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && valid.has(t) && t !== TODOS_VALUE)
    );
  }, [raw, options]);

  // No modo "todos", count NÃO conta a opção "Todos".
  const count = selected.size;

  const commit = useCallback(
    (next: Set<string>) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (next.size === 0) params.delete(param);
      else params.set(param, Array.from(next).join(","));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [param, router, sp]
  );

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(selected);
      if (mode === "todos" && value === TODOS_VALUE) {
        next.clear();
        commit(next);
        return;
      }
      if (next.has(value)) next.delete(value);
      else next.add(value);
      commit(next);
    },
    [selected, mode, commit]
  );

  const clear = useCallback(() => {
    if (count === 0) return;
    commit(new Set<string>());
  }, [count, commit]);

  // Clique fora fecha.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Escape fecha e devolve foco ao trigger.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const allOption: MultiSelectOption[] =
    mode === "todos" ? [{ value: TODOS_VALUE, label: "Todos" }] : [];
  const renderedOptions = [...allOption, ...options.filter((o) => o.value !== TODOS_VALUE)];
  const todosActive = mode === "todos" && count === 0;

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-medium text-foreground transition-colors",
          "border-input bg-card hover:border-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          open && "border-foreground bg-accent"
        )}
      >
        <span>{label}</span>
        <span
          className={cn(
            "h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 font-mono text-[11px] leading-none text-background",
            count > 0 ? "inline-flex" : "hidden"
          )}
        >
          {count}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        role="listbox"
        aria-multiselectable="true"
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-md border border-border bg-card shadow-lg",
          "transition-[opacity,transform] duration-150",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        {header && (
          <div className="border-b border-border p-2">{header}</div>
        )}
        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {renderedOptions.map((o) => {
            const isTodos = mode === "todos" && o.value === TODOS_VALUE;
            const checked = isTodos ? todosActive : selected.has(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-accent"
              >
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    className={cn(
                      "h-4 w-4 cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-input transition-colors",
                      "checked:border-foreground checked:bg-foreground"
                    )}
                  />
                  {checked && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-background"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-[13px]">{o.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-end border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={clear}
            disabled={count === 0}
            className={cn(
              "rounded px-2 py-1 text-[12px] font-medium transition-colors",
              count === 0
                ? "cursor-not-allowed text-muted-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
