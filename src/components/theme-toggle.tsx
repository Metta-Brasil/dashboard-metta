"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes só resolve o tema no cliente; sem o gate o highlight
  // do botão ativo causa mismatch de hidratação.
  useEffect(() => setMounted(true), []);
  const active = mounted ? theme : undefined;

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="inline-flex w-full max-w-md rounded-lg border border-border bg-card p-1 sm:w-auto"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const isActive = active === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
