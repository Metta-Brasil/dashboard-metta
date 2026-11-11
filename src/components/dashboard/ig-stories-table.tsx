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
  IG_STORIES_COLUMNS,
  IG_STORIES_TITULO,
  igStoriesDescricao,
  igStoryCells,
  type IgStoryTableRow,
} from "./ig-table-cells";

export type { IgStoryTableRow };

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "VIDEO", label: "Vídeo" },
  { value: "IMAGE", label: "Imagem" },
] as const;

const COLUMNS: InteractiveColumn[] = [...IG_STORIES_COLUMNS, IG_LINK_COLUMN];

export function IgStoriesTable({ rows }: { rows: IgStoryTableRow[] }) {
  const [tipo, setTipo] = useState<string>("todos");

  const filtered = useMemo(
    () =>
      rows.filter((r) => tipo === "todos" || r.tipo.toUpperCase() === tipo),
    [rows, tipo]
  );

  const interactiveRows: InteractiveRow[] = useMemo(
    () =>
      filtered.map((r) => ({
        cells: [
          // Texto de cada célula vem de `igStoryCells` (o mesmo que o MCP
          // serializa).
          ...igStoryCells(r).map((c) => ({
            node: c.text,
            sortValue: c.sortValue,
          })),
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
          <h3 className="panel-title">{IG_STORIES_TITULO}</h3>
          <span className="panel-desc">
            {igStoriesDescricao(filtered.length, rows.length)}
          </span>
        </div>
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
      </div>

      <MetricTableInteractive
        columns={COLUMNS}
        rows={interactiveRows}
        totalRow={null}
        alwaysShowTotal={false}
        maxRows={50}
        empty="Nenhum story coletado no período."
        exportName="instagram-stories"
        searchable={false}
      />
    </div>
  );
}
