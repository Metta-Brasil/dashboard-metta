/**
 * Cálculo da página Metas vs Realizado.
 *
 * Stub: a aba `Metas` ainda não existe na planilha. Esta função aceita um
 * `rawMetas` opcional. Quando ele vier vazio, retorna estrutura vazia para
 * a página renderizar o estado "metas não configuradas".
 *
 * Estrutura prevista (ver project_dashboard_metta_metas_sheet.md):
 *   funil | metrica | mes | valor
 *
 * Pareamento "realizado" virá de cálculos das outras páginas — o caller passa
 * o realizado já agregado por (funil, metrica, mes) via `realizado`.
 */

import { parseValor, safeRate } from "./shared";
import type { FilterState, MetaRow, MetasResult, Row } from "./types";

export type MetasInput = {
  /** Linhas da aba Metas (ainda a criar). TODO: confirmar headers reais. */
  rawMetas?: Row[];
  /** Realizado pré-computado, indexado por chave "funil|metrica|mes". */
  realizado?: Map<string, number>;
};

function metaFunil(r: Row): string {
  const v = r["Funil"] ?? r["funil"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function metaMetrica(r: Row): string {
  const v = r["Métrica"] ?? r["Metrica"] ?? r["metrica"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function metaMes(r: Row): string {
  const v = r["Mês"] ?? r["Mes"] ?? r["mes"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function metaValor(r: Row): number {
  return parseValor(
    (r["Valor"] ?? r["valor"] ?? r["Meta"]) as string | number | undefined
  );
}

export function calcMetas(
  input: MetasInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- filtros usados em versão futura
  _filters: FilterState
): MetasResult {
  const rows: MetaRow[] = (input.rawMetas ?? []).map((r) => {
    const funil = metaFunil(r);
    const metrica = metaMetrica(r);
    const mes = metaMes(r);
    const metaV = metaValor(r);
    const key = `${funil}|${metrica}|${mes}`;
    const realizadoV = input.realizado?.get(key) ?? 0;
    return {
      funil,
      metrica,
      mes,
      metaValor: metaV,
      realizadoValor: realizadoV,
      atingimento: safeRate(realizadoV, metaV),
    };
  });

  // Resumo por funil: soma da meta e do realizado.
  const porFunil = new Map<
    string,
    { metaTotal: number; realizadoTotal: number }
  >();
  for (const r of rows) {
    const acc = porFunil.get(r.funil) ?? {
      metaTotal: 0,
      realizadoTotal: 0,
    };
    acc.metaTotal += r.metaValor;
    acc.realizadoTotal += r.realizadoValor;
    porFunil.set(r.funil, acc);
  }

  const resumoPorFunil = Array.from(porFunil.entries()).map(([funil, v]) => ({
    funil,
    metaTotal: v.metaTotal,
    realizadoTotal: v.realizadoTotal,
    atingimento: safeRate(v.realizadoTotal, v.metaTotal),
  }));

  return { rows, resumoPorFunil };
}
