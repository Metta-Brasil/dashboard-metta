"use client";

import { ptBR } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Range = { from: Date; to: Date };

function fmt(d: Date): string {
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    .replace(/\//g, "/");
}

function fmtIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PRESETS: Array<{ label: string; build: () => Range }> = [
  {
    label: "Hoje",
    build: () => {
      const d = new Date();
      return { from: d, to: new Date() };
    },
  },
  {
    label: "Ontem",
    build: () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();
      to.setDate(to.getDate() - 1);
      return { from, to };
    },
  },
  {
    label: "Últimos 7 dias",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 6);
      return { from, to };
    },
  },
  {
    label: "Últimos 14 dias",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 13);
      return { from, to };
    },
  },
  {
    label: "Últimos 30 dias",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 29);
      return { from, to };
    },
  },
  {
    label: "Últimos 90 dias",
    build: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 89);
      return { from, to };
    },
  },
  {
    label: "Este mês",
    build: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { from, to };
    },
  },
  {
    label: "Mês passado",
    build: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to };
    },
  },
  {
    label: "Este ano",
    build: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), 0, 1);
      return { from, to };
    },
  },
  {
    label: "Ano passado",
    build: () => {
      const y = new Date().getFullYear() - 1;
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
    },
  },
];

export function DateRangePopover({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>({ from, to });
  const isMobile = useIsMobile();

  // Re-sincroniza com as props quando a URL muda (navegação, voltar,
  // outro filtro). Sem isto o botão/calendário ficam presos no range
  // inicial e o filtro PARECE não ter saído do mês atual, mesmo o
  // servidor já tendo recalculado com o período novo. Ajuste de estado
  // durante o render (padrão React, sem effect).
  const propKey = `${from.getTime()}-${to.getTime()}`;
  const [syncedKey, setSyncedKey] = useState(propKey);
  if (propKey !== syncedKey) {
    setSyncedKey(propKey);
    setRange({ from, to });
  }

  function apply(next: Range) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("from", fmtIso(next.from));
    params.set("to", fmtIso(next.to));
    router.replace(`?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <CalendarIcon />
            {fmt(range.from)} — {fmt(range.to)}
          </button>
        }
      />
      <PopoverContent
        align={isMobile ? "center" : "end"}
        className="flex w-auto max-w-[min(680px,calc(100vw-1.5rem))] flex-col gap-3 p-3 sm:flex-row"
      >
        {isMobile ? (
          <QuickPick
            onPick={(p) => {
              const r = p.build();
              setRange(r);
              apply(r);
            }}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() => {
                  const r = p.build();
                  setRange(r);
                  apply(r);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
        <Separator orientation="vertical" className="hidden sm:block" />
        <div className="flex flex-col gap-2">
          <Calendar
            mode="range"
            locale={ptBR}
            selected={{ from: range.from, to: range.to }}
            onSelect={(r) => {
              if (r?.from && r?.to) setRange({ from: r.from, to: r.to });
            }}
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={range.from}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={() => apply(range)}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Seleção rápida (mobile) — mesmo padrão visual dos demais filtros
 * (trigger h-9 + caret + painel bg-card/shadow). Single-select:
 * escolher um preset aplica o período na hora e fecha.
 */
function QuickPick({
  onPick,
}: {
  onPick: (p: (typeof PRESETS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-[13px] font-medium text-foreground transition-colors",
          "border-input bg-card hover:border-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          open && "border-foreground bg-accent"
        )}
      >
        <span>Seleção rápida</span>
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
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[200px] rounded-md border border-border bg-card shadow-lg",
          "transition-[opacity,transform] duration-150",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        <div className="max-h-[260px] overflow-y-auto p-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="option"
              onClick={() => {
                setOpen(false);
                onPick(p);
              }}
              className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-accent"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
