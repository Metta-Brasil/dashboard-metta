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
export type IgStoryTableRow = {
  storyId: string;
  tipo: string;
  tipoLabel: string;
  dataFmt: string;
  dataTs: number;
  hora: string;
  views: number;
  alcance: number;
  navegacao: number;
  respostas: number;
  compartilhamentos: number;
  interacoes: number;
  seguidores: number;
  visitasPerfil: number;
  permalink: string;
};

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "VIDEO", label: "Vídeo" },
  { value: "IMAGE", label: "Imagem" },
] as const;

const COLUMNS: InteractiveColumn[] = [
  { key: "data", header: "Data", sortable: true },
  { key: "hora", header: "Hora", sortable: true },
  { key: "tipo", header: "Tipo", sortable: true },
  { key: "views", header: "Views", align: "right", sortable: true },
  { key: "alcance", header: "Alcance", align: "right", sortable: true },
  { key: "navegacao", header: "Navegação", align: "right", sortable: true },
  { key: "respostas", header: "Respostas", align: "right", sortable: true },
  { key: "compartilhamentos", header: "Compart.", align: "right", sortable: true },
  { key: "interacoes", header: "Interações", align: "right", sortable: true },
  { key: "seguidores", header: "Seguidores", align: "right", sortable: true },
  { key: "visitasPerfil", header: "Visitas perfil", align: "right", sortable: true },
  { key: "link", header: "Link", align: "center", sortable: false },
];

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
          { node: r.dataFmt, sortValue: r.dataTs },
          { node: r.hora || "—", sortValue: r.hora },
          { node: r.tipoLabel, sortValue: r.tipoLabel },
          { node: formatInt(r.views), sortValue: r.views },
          { node: formatInt(r.alcance), sortValue: r.alcance },
          { node: formatInt(r.navegacao), sortValue: r.navegacao },
          { node: formatInt(r.respostas), sortValue: r.respostas },
          { node: formatInt(r.compartilhamentos), sortValue: r.compartilhamentos },
          { node: formatInt(r.interacoes), sortValue: r.interacoes },
          { node: formatInt(r.seguidores), sortValue: r.seguidores },
          { node: formatInt(r.visitasPerfil), sortValue: r.visitasPerfil },
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
          <h3 className="panel-title">Todos os stories</h3>
          <span className="panel-desc">
            {filtered.length} de {rows.length} stories no período · histórico
            acumulado a partir da coleta
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
      />
    </div>
  );
}
