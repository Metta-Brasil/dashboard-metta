import { formatBRL, formatPercent } from "@/lib/calc/shared";

/**
 * Formatação dos valores dos gráficos, fora do módulo de cliente de
 * propósito: o gráfico (tooltip e eixo) e o MCP (que serializa os mesmos
 * dados em texto) usam ESTAS funções. Num módulo "use client" elas não
 * poderiam ser chamadas no servidor.
 */

/** Formatação de valor no eixo Y / tooltip. */
export type ValueFormat = "number" | "percent" | "currency";

export function makeValueFormatter(
  fmt: ValueFormat
): (v: string | number) => string {
  return (v) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (fmt === "percent") return formatPercent(n);
    if (fmt === "currency") return formatBRL(n);
    return n.toLocaleString("pt-BR");
  };
}

/** Rótulo de uma fatia do donut: valor e participação no total. */
export function donutValueLabel(value: number, total: number): string {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return `${value.toLocaleString("pt-BR")} · ${pct.toFixed(1)}%`;
}
