/**
 * Cálculo da página Comercial Closer.
 *
 * Usa: sdr (reuniões realizadas que viraram propostas/vendas) + vendas (fechadas).
 */

import {
  filterByDate,
  filterByFunil,
  parseData,
  parseValor,
  safeRate,
  sumBy,
} from "./shared";
import type {
  CloserResult,
  CloserRow,
  FilterState,
  RawData,
  Row,
} from "./types";

function sdrDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data da reunião"] ?? r["created_at"]
  );
}

function sdrStatus(r: Row): string {
  const v = r["Status"] ?? r["status"] ?? r["K"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function sdrFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

/** Nome do closer responsável pela reunião. TODO: confirmar header. */
function sdrCloser(r: Row): string {
  const v =
    r["Closer"] ??
    r["closer"] ??
    r["Vendedor"] ??
    r["vendedor"] ??
    r["Responsável"] ??
    r["Responsavel"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

/** Indica que houve proposta enviada. TODO: confirmar coluna real. */
function sdrTemProposta(r: Row): boolean {
  const v = r["Proposta"] ?? r["proposta"];
  if (v === undefined || v === null || v === "") {
    // Fallback: status contém "proposta"
    return sdrStatus(r).toLowerCase().includes("proposta");
  }
  const s = String(v).toLowerCase();
  return s === "true" || s === "sim" || s === "yes" || s === "1" || !!parseValor(v as string | number);
}

function vendaDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data fechamento"] ?? r["closed_at"]
  );
}

function vendaFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["K"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function vendaCloser(r: Row): string {
  const v =
    r["Closer"] ??
    r["closer"] ??
    r["Vendedor"] ??
    r["vendedor"] ??
    r["Responsável"] ??
    r["Responsavel"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

function vendaValor(r: Row): number {
  return parseValor(
    (r["Valor"] ?? r["valor"] ?? r["Faturamento"] ?? r["amount"]) as
      | string
      | number
      | undefined
  );
}

export function calcCloser(
  raw: Pick<RawData, "sdr" | "vendas">,
  filters: FilterState
): CloserResult {
  const { from, to, funis } = filters;

  const sdrFiltrado = filterByFunil(
    filterByDate(raw.sdr, sdrDate, from, to),
    sdrFunil,
    funis
  );

  const vendasFiltrado = filterByFunil(
    filterByDate(raw.vendas, vendaDate, from, to),
    vendaFunil,
    funis
  );

  // --- KPIs ----------------------------------------------------------------
  const reunioes = sdrFiltrado.filter((r) =>
    sdrStatus(r).toLowerCase().includes("realiz")
  ).length;

  const propostas = sdrFiltrado.filter(sdrTemProposta).length;

  const vendas = vendasFiltrado.length;
  const faturamento = sumBy(vendasFiltrado, vendaValor);
  const ticketMedio = safeRate(faturamento, vendas);
  const taxaProposta = safeRate(propostas, reunioes);
  const taxaFechamento = safeRate(vendas, propostas);

  // --- Por closer ---------------------------------------------------------
  const reuPorCloser = new Map<string, number>();
  const propPorCloser = new Map<string, number>();
  for (const r of sdrFiltrado) {
    const name = sdrCloser(r) || "—";
    if (sdrStatus(r).toLowerCase().includes("realiz"))
      reuPorCloser.set(name, (reuPorCloser.get(name) ?? 0) + 1);
    if (sdrTemProposta(r))
      propPorCloser.set(name, (propPorCloser.get(name) ?? 0) + 1);
  }

  const vendasPorCloser = new Map<string, Row[]>();
  for (const r of vendasFiltrado) {
    const name = vendaCloser(r) || "—";
    const b = vendasPorCloser.get(name);
    if (b) b.push(r);
    else vendasPorCloser.set(name, [r]);
  }

  const nomes = new Set<string>([
    ...reuPorCloser.keys(),
    ...propPorCloser.keys(),
    ...vendasPorCloser.keys(),
  ]);

  const porCloser: CloserRow[] = Array.from(nomes)
    .map((name) => {
      const reu = reuPorCloser.get(name) ?? 0;
      const prop = propPorCloser.get(name) ?? 0;
      const venRows = vendasPorCloser.get(name) ?? [];
      const v = venRows.length;
      const fat = sumBy(venRows, vendaValor);
      return {
        closer: name,
        reunioes: reu,
        propostas: prop,
        vendas: v,
        faturamento: fat,
        ticketMedio: safeRate(fat, v),
        taxaProposta: safeRate(prop, reu),
        taxaFechamento: safeRate(v, prop),
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento);

  return {
    kpis: {
      reunioes,
      propostas,
      vendas,
      faturamento,
      ticketMedio,
      taxaProposta,
      taxaFechamento,
    },
    porCloser,
  };
}
