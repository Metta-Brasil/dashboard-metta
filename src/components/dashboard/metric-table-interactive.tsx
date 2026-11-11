"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type InteractiveColumn = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  sortable: boolean;
};

export type InteractiveCell = {
  node: React.ReactNode;
  /** Raw comparable value for sorting; null when not comparable. */
  sortValue: number | string | null;
};

export type InteractiveRow = {
  cells: InteractiveCell[];
};

type SortState = { col: number; dir: "asc" | "desc" } | null;

type MetricTableInteractiveProps = {
  columns: InteractiveColumn[];
  rows: InteractiveRow[];
  totalRow: InteractiveRow | null;
  /** Mostra o total mesmo sem linhas (preserva o footer custom da página). */
  alwaysShowTotal: boolean;
  /** Acima de N linhas → altura limitada + scroll vertical, header e
   *  total fixos (sticky). */
  maxRows?: number;
  empty: string;
  /**
   * Nome do arquivo do botão "CSV" (sem extensão nem data). Ausente = sem
   * exportação. O CSV sai do que está na tela: mesma ordem, mesma busca,
   * com a linha de total por último.
   */
  exportName?: string;
  /** Campo de busca. Padrão: aparece a partir de 10 linhas. */
  searchable?: boolean;
  /**
   * Busca e CSV sobem para a linha do título do card (canto superior
   * direito), em vez de ocuparem uma faixa própria. Exige um pai `relative`
   * com o título à esquerda; no celular continuam numa linha acima da tabela.
   */
  floatTools?: boolean;
};

/** Sem caixa e sem acento, para a busca. */
const semAcento = (v: string): string =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** A partir de quantas linhas a busca aparece sozinha. */
const BUSCA_MIN_LINHAS = 10;

const slugArquivo = (v: string): string =>
  semAcento(v)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tabela";

/**
 * CSV do que a tabela mostra agora. Lê o texto das células no DOM (elas
 * chegam aqui já renderizadas pelo servidor), com `;` e BOM para o Excel em
 * português abrir direto com acentos e colunas no lugar.
 */
function baixarCsv(table: HTMLTableElement, nome: string) {
  const linhas: string[] = [];
  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    const cells = Array.from(tr.querySelectorAll("th,td")) as HTMLElement[];
    if (cells.length === 1 && cells[0].hasAttribute("colspan")) continue; // linha de vazio
    linhas.push(
      cells
        .map((c) => {
          const t = (c.innerText ?? c.textContent ?? "")
            .replace(/[↕▲▼]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        })
        .join(";"),
    );
  }
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const blob = new Blob(["\ufeff" + linhas.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugArquivo(nome)}-${hoje}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Altura aproximada de uma linha (px-3 py-2.5 + text-sm + borda). */
const ROW_REM = 2.6;

function compare(a: number | string | null, b: number | string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

export function MetricTableInteractive({
  columns,
  rows,
  totalRow,
  alwaysShowTotal,
  maxRows,
  empty,
  exportName,
  searchable,
  floatTools,
}: MetricTableInteractiveProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [busca, setBusca] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);
  const comBusca = searchable ?? rows.length >= BUSCA_MIN_LINHAS;

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (r1, r2) =>
        factor * compare(r1.cells[col]?.sortValue, r2.cells[col]?.sortValue),
    );
  }, [rows, sort]);

  // Busca pelo texto das colunas (o mesmo valor usado para ordenar).
  const termo = semAcento(busca.trim());
  const visibleRows = useMemo(() => {
    if (!termo) return sortedRows;
    return sortedRows.filter((r) =>
      r.cells.some(
        (c) =>
          c.sortValue !== null &&
          semAcento(String(c.sortValue)).includes(termo),
      ),
    );
  }, [sortedRows, termo]);

  function toggleSort(col: number) {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }

  const scrollable = maxRows != null && rows.length > maxRows;

  const comFerramentas = rows.length > 0 && (comBusca || Boolean(exportName));

  return (
    <>
      {comFerramentas && (
        <div
          className={cn(
            "mb-2 flex flex-wrap items-center justify-end gap-2",
            floatTools &&
              "sm:absolute sm:right-5 sm:top-4 sm:mb-0 lg:right-6 lg:top-5",
          )}
        >
          {comBusca && (
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar na tabela"
              className="h-8 w-44 max-w-full rounded-md border border-input bg-card px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
            />
          )}
          {exportName && (
            <button
              type="button"
              onClick={() =>
                tableRef.current && baixarCsv(tableRef.current, exportName)
              }
              title="Baixar o que está na tabela (ordem e busca aplicadas)"
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-card px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              CSV
            </button>
          )}
        </div>
      )}
      <div
        className={cn("-mx-2 overflow-x-auto", scrollable && "overflow-y-auto")}
        style={
          scrollable
            ? { maxHeight: `calc(${maxRows} * ${ROW_REM}rem + 3rem)` }
            : undefined
        }
      >
        <table
          ref={tableRef}
          className="w-full border-separate border-spacing-0 text-[8.4px] sm:text-sm"
        >
          <thead>
            <tr className="text-[7px] uppercase tracking-[0.07em] text-muted-foreground sm:text-[11px]">
              {columns.map((c, ci) => {
                const active = sort?.col === ci;
                const stickyFirst = ci === 0;
                const thCls = cn(
                  "border-b border-border px-3 py-2.5 font-medium first:rounded-l-md last:rounded-r-md",
                  stickyFirst
                    ? cn(
                        "sticky left-0 bg-muted",
                        scrollable ? "top-0 z-30" : "z-20",
                      )
                    : scrollable
                      ? "sticky top-0 z-20 bg-muted"
                      : "bg-muted/40",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  !c.align && "text-left",
                  c.className,
                );
                if (!c.sortable) {
                  return (
                    <th key={c.key} className={thCls} scope="col">
                      {c.header}
                    </th>
                  );
                }
                return (
                  <th key={c.key} className={thCls} scope="col">
                    <button
                      type="button"
                      onClick={() => toggleSort(ci)}
                      aria-sort={
                        active
                          ? sort?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={cn(
                        "inline-flex items-center gap-1 font-medium uppercase tracking-[0.07em] transition-colors hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                        active && "text-foreground",
                      )}
                    >
                      <span>{c.header}</span>
                      <span
                        aria-hidden
                        className={cn(
                          "text-[0.4rem] leading-none sm:text-[0.65rem]",
                          active ? "opacity-100" : "opacity-30",
                        )}
                      >
                        {active ? (sort?.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  Nada encontrado para “{busca.trim()}”.
                </td>
              </tr>
            ) : (
              visibleRows.map((r, i) => (
                <tr
                  key={i}
                  className="group transition-colors hover:bg-accent/60"
                >
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-border/50 px-3 py-2.5 tabular-nums text-foreground/90 group-last:border-b-0",
                        ci === 0 && "sticky left-0 z-10 bg-[var(--card)]",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {r.cells[ci]?.node}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {totalRow && (rows.length > 0 || alwaysShowTotal) && (
              <tr className="font-semibold text-foreground">
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    className={cn(
                      "border-t-2 border-border px-3 py-2.5 tabular-nums first:rounded-bl-md last:rounded-br-md",
                      ci === 0
                        ? cn(
                            "sticky left-0 bg-muted",
                            scrollable ? "bottom-0 z-30" : "z-20",
                          )
                        : scrollable
                          ? "sticky bottom-0 z-20 bg-muted"
                          : "bg-muted/50",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {totalRow.cells[ci]?.node}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
