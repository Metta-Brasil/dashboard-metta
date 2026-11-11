"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  MetricTableInteractive,
  type InteractiveColumn,
  type InteractiveRow,
} from "@/components/dashboard/metric-table-interactive";
import { cn } from "@/lib/utils";

import {
  IG_LINK_COLUMN,
  IG_POSTS_COLUMNS,
  IG_POSTS_TITULO,
  igPostCells,
  igPostsDescricao,
  type IgPostTableRow,
} from "./ig-table-cells";

export type { IgPostTableRow };

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "VIDEO", label: "Reels" },
  { value: "CAROUSEL_ALBUM", label: "Carrossel" },
  { value: "IMAGE", label: "Imagem" },
] as const;

const COLUMNS: InteractiveColumn[] = [...IG_POSTS_COLUMNS, IG_LINK_COLUMN];

export function IgPostsTable({ rows }: { rows: IgPostTableRow[] }) {
  const [tipo, setTipo] = useState<string>("todos");
  const [query, setQuery] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipo !== "todos" && r.tipo.toUpperCase() !== tipo) return false;
      if (q && !r.legenda.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, tipo, query]);

  const interactiveRows: InteractiveRow[] = useMemo(
    () =>
      filtered.map((r) => ({
        cells: [
          // Texto de cada célula vem de `igPostCells` (o mesmo que o MCP
          // serializa); aqui só a legenda ganha o title com o texto inteiro.
          ...igPostCells(r).map((c, i) =>
            IG_POSTS_COLUMNS[i].key === "legenda"
              ? {
                  node: (
                    <span
                      className="block max-w-[280px] truncate"
                      title={r.legenda}
                    >
                      {c.text}
                    </span>
                  ),
                  sortValue: c.sortValue,
                }
              : { node: c.text, sortValue: c.sortValue }
          ),
          {
            node: r.permalink ? (
              <Link
                href={r.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Ver
              </Link>
            ) : (
              "—"
            ),
            sortValue: null,
          },
        ],
      })),
    [filtered]
  );

  return (
    <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="panel-title">{IG_POSTS_TITULO}</h3>
          <span className="panel-desc">
            {igPostsDescricao(filtered.length, rows.length)}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            {TIPO_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setTipo(o.value)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  tipo === o.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na legenda…"
            className="h-8 w-full rounded-md border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary sm:w-56"
          />
        </div>
      </div>

      <MetricTableInteractive
        columns={COLUMNS}
        rows={interactiveRows}
        totalRow={null}
        alwaysShowTotal={false}
        maxRows={50}
        empty="Nenhum post encontrado."
      />
    </div>
  );
}
