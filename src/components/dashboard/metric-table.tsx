import { isValidElement } from "react";

import { formatBRL, formatBRLCompact, formatInt } from "@/lib/calc/shared";
import { cn } from "@/lib/utils";

import {
  MetricTableInteractive,
  type InteractiveCell,
  type InteractiveColumn,
  type InteractiveRow,
} from "./metric-table-interactive";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /**
   * Como agregar a coluna na linha TOTAL automática:
   * - `"sum"`: força a soma (inteiros/moeda absoluta — leads, investimento…);
   * - `"none"`: sem total (`—`) — rótulos, datas, dimensões;
   * - função: total derivado, calculado pela página sobre todas as linhas.
   *   Usar para custos (CPM = Σvalor/Σimpr·1000) e taxas (CTR = Σcliques/Σimpr).
   * Ausente → heurística automática (compat: soma se a coluna for aditiva).
   */
  total?: "sum" | "none" | ((rows: T[]) => React.ReactNode);
};

type MetricTableProps<T> = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  /**
   * Linha de total custom já calculada pela página. Quando informada,
   * o total automático é desligado (a página já injeta o seu próprio).
   */
  footer?: T;
  /**
   * Liga/desliga a linha de total consolidado automática.
   * Default: `true` (mas ignorado quando `footer` é informado, para não duplicar).
   */
  showTotal?: boolean;
  /** Liga/desliga a ordenação por coluna. Default: `true`. */
  sortable?: boolean;
  /** Acima de N linhas, limita a altura a ~N linhas e ativa scroll
   *  vertical (cabeçalho e linha TOTAL ficam fixos). */
  maxRows?: number;
  empty?: string;
  className?: string;
};

/** Extrai texto plano de um React node (cobre strings/números dos formatters). */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return nodeText(props.children);
  }
  return "";
}

const PERCENT_RE = /%/;

export function MetricTable<T>({
  title,
  description,
  toolbar,
  columns,
  rows,
  footer,
  showTotal = true,
  sortable = true,
  maxRows,
  empty = "Sem dados no período.",
  className,
}: MetricTableProps<T>) {
  // A página informou um total próprio → não gerar o automático (evita duplicar).
  const autoTotal = showTotal && footer === undefined && rows.length > 0;

  // Cache do texto renderizado por (linha, coluna) para reaproveitar
  // na detecção de %, no valor de ordenação e no render do corpo.
  const renderedNodes: React.ReactNode[][] = rows.map((r) =>
    columns.map((c) => c.render(r))
  );

  // Inferência de coluna aditiva (data-driven, sem adivinhar por nome):
  // - não é a 1ª coluna (rótulo);
  // - todo valor bruto em `row[col.key]` é número finito;
  // - a coluna não é percentual/taxa (texto renderizado não contém "%");
  // - a formatação é consistente entre linhas (somar moeda+contagem na
  //   mesma coluna não faz sentido).
  const additive: boolean[] = columns.map((c, ci) => {
    if (ci === 0) return false;
    if (rows.length === 0) return false;
    let sawValue = false;
    let currencyKind: boolean | null = null;
    for (let ri = 0; ri < rows.length; ri += 1) {
      const raw = (rows[ri] as Record<string, unknown>)[c.key];
      if (raw == null) continue;
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      const text = nodeText(renderedNodes[ri][ci]);
      if (PERCENT_RE.test(text)) return false;
      const isCurrency = /R\$/.test(text);
      if (currencyKind === null) currencyKind = isCurrency;
      else if (currencyKind !== isCurrency) return false;
      sawValue = true;
    }
    return sawValue;
  });

  const interactiveColumns: InteractiveColumn[] = columns.map((c) => ({
    key: c.key,
    header: c.header,
    align: c.align,
    className: c.className,
    sortable: sortable && rows.length > 0,
  }));

  function rawValue(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  const interactiveRows: InteractiveRow[] = rows.map((r, ri) => ({
    cells: columns.map((c, ci): InteractiveCell => {
      const raw = rawValue(r, c.key);
      const node = renderedNodes[ri][ci];
      const sortValue: number | string | null =
        typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : nodeText(node) || null;
      return { node, sortValue };
    }),
  }));

  let totalRow: InteractiveRow | null = null;

  if (footer !== undefined) {
    // Total próprio da página: renderiza como veio, sem somar nem ordenar.
    totalRow = {
      cells: columns.map((c): InteractiveCell => ({
        node: c.render(footer),
        sortValue: null,
      })),
    };
  } else if (autoTotal) {
    // Soma uma coluna e formata seguindo o estilo (moeda/compacto/inteiro)
    // inferido de uma amostra renderizada da própria coluna.
    const sumCell = (c: Column<T>, ci: number): InteractiveCell => {
      const sum = rows.reduce((acc, r) => {
        const raw = rawValue(r, c.key);
        return typeof raw === "number" && Number.isFinite(raw)
          ? acc + raw
          : acc;
      }, 0);
      let sample = "";
      for (let ri = 0; ri < rows.length; ri += 1) {
        const raw = rawValue(rows[ri], c.key);
        if (typeof raw === "number" && Number.isFinite(raw)) {
          sample = nodeText(renderedNodes[ri][ci]);
          if (sample) break;
        }
      }
      const isCurrency = /R\$/.test(sample);
      const isCompact = isCurrency && /k\b/i.test(sample);
      const totalText = isCompact
        ? formatBRLCompact(sum)
        : isCurrency
          ? formatBRL(sum)
          : formatInt(sum);
      return { node: totalText, sortValue: null };
    };

    totalRow = {
      cells: columns.map((c, ci): InteractiveCell => {
        if (ci === 0) {
          return { node: "Total", sortValue: null };
        }
        const spec = c.total;
        if (typeof spec === "function") {
          // Total derivado (custo/taxa) computado pela página sobre as linhas.
          return { node: spec(rows), sortValue: null };
        }
        if (spec === "none") {
          return { node: "—", sortValue: null };
        }
        if (spec === "sum") {
          return sumCell(c, ci);
        }
        // Heurística (compat): só soma se a coluna for aditiva.
        if (!additive[ci]) {
          return { node: "—", sortValue: null };
        }
        return sumCell(c, ci);
      }),
    };
  }

  return (
    <div
      className={cn("surface-card flex flex-col gap-4 p-5 lg:p-6", className)}
    >
      {(title || toolbar) && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-col gap-1">
            {title && <h3 className="panel-title">{title}</h3>}
            {description && <span className="panel-desc">{description}</span>}
          </div>
          {toolbar && (
            <div className="flex items-center gap-2">{toolbar}</div>
          )}
        </div>
      )}

      <MetricTableInteractive
        columns={interactiveColumns}
        rows={interactiveRows}
        totalRow={totalRow}
        alwaysShowTotal={footer !== undefined}
        maxRows={maxRows}
        empty={empty}
      />
    </div>
  );
}
