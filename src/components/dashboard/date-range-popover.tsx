"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

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
        className="flex w-auto max-w-[min(680px,calc(100vw-1.5rem))] max-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-y-auto p-3 sm:max-h-none sm:flex-row sm:overflow-visible"
      >
        {isMobile ? (
          // Mobile: seleção rápida vira um select nativo (picker do SO) —
          // a fileira horizontal de presets não cabia na tela.
          <select
            aria-label="Seleção rápida de período"
            defaultValue=""
            onChange={(e) => {
              const p = PRESETS[Number(e.target.value)];
              if (!p) return;
              const r = p.build();
              setRange(r);
              apply(r);
            }}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" disabled>
              Seleção rápida
            </option>
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
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
