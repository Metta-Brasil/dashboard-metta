"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  MetricTableInteractive,
  type InteractiveColumn,
  type InteractiveRow,
} from "@/components/dashboard/metric-table-interactive";
import { formatInt } from "@/lib/calc/shared";
import { cn } from "@/lib/utils";

/** Linha serializável (sem Date) montada no server e passada pro client. */
export type IgPostTableRow = {
  postId: string;
  tipo: string;
  tipoLabel: string;
  legenda: string;
  dataFmt: string;
  dataTs: number;
  hora: string;
  views: number;
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  visitasPerfil: number;
  seguidores: number;
  er: number;
  permalink: string;
};

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "VIDEO", label: "Reels" },
  { value: "CAROUSEL_ALBUM", label: "Carrossel" },
  { value: "IMAGE", label: "Imagem" },
] as const;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

const COLUMNS: InteractiveColumn[] = [
  { key: "tipo", header: "Tipo", sortable: true },
  { key: "legenda", header: "Legenda", sortable: true },
  { key: "data", header: "Data", sortable: true },
  { key: "hora", header: "Hora", sortable: true },
  { key: "views", header: "Views", align: "right", sortable: true },
  { key: "alcance", header: "Alcance", align: "right", sortable: true },
  { key: "curtidas", header: "Curtidas", align: "right", sortable: true },
  { key: "comentarios", header: "Coment.", align: "right", sortable: true },
  { key: "salvamentos", header: "Salv.", align: "right", sortable: true },
  { key: "visitasPerfil", header: "Visitas perfil", align: "right", sortable: true },
  { key: "seguidores", header: "Seguidores", align: "right", sortable: true },
  { key: "er", header: "ER%", align: "right", sortable: true },
  { key: "link", header: "Link", align: "center", sortable: false },
];

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
          { node: r.tipoLabel, sortValue: r.tipoLabel },
          {
            node: (
              <span className="block max-w-[280px] truncate" title={r.legenda}>
                {truncate(r.legenda, 70)}
              </span>
            ),
            sortValue: r.legenda,
          },
          { node: r.dataFmt, sortValue: r.dataTs },
          { node: r.hora || "—", sortValue: r.hora },
          { node: formatInt(r.views), sortValue: r.views },
          { node: formatInt(r.alcance), sortValue: r.alcance },
          { node: formatInt(r.curtidas), sortValue: r.curtidas },
          { node: formatInt(r.comentarios), sortValue: r.comentarios },
          { node: formatInt(r.salvamentos), sortValue: r.salvamentos },
          { node: formatInt(r.visitasPerfil), sortValue: r.visitasPerfil },
          { node: formatInt(r.seguidores), sortValue: r.seguidores },
          {
            node: Number.isFinite(r.er) ? `${r.er.toFixed(2)}%` : "—",
            sortValue: Number.isFinite(r.er) ? r.er : null,
          },
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
          <h3 className="panel-title">Todos os posts</h3>
          <span className="panel-desc">
            {filtered.length} de {rows.length} posts no período
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
