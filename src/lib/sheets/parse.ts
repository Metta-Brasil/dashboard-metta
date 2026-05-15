import type { ZodTypeAny, z } from "zod";

const HEADER_ROW = 1;

/**
 * Parser genérico de Sheets values → array tipado.
 * - Pula a primeira linha (cabeçalho).
 * - Mapeia colunas via `columnMap` (chave do schema → índice da coluna).
 * - Valida cada linha com Zod. Falhas são logadas e descartadas.
 * - Lança erro fatal apenas se 0 linhas válidas (schema drift grave).
 */
export function parseSheetData<S extends ZodTypeAny>(
  schema: S,
  values: unknown[][] | undefined | null,
  columnMap: Record<string, number>,
  context: { tab: string }
): z.infer<S>[] {
  if (!values || values.length < 2) return [];
  const rows = values.slice(HEADER_ROW);
  const errors: string[] = [];

  const parsed = rows
    .map((row, idx) => {
      const obj: Record<string, unknown> = {};
      for (const [key, colIdx] of Object.entries(columnMap)) {
        obj[key] = row[colIdx] ?? null;
      }
      const result = schema.safeParse(obj);
      if (!result.success) {
        errors.push(`[${context.tab}] linha ${idx + 2}: ${result.error.message}`);
        return null;
      }
      return result.data as z.infer<S>;
    })
    .filter((x): x is z.infer<S> => x !== null);

  if (errors.length > 0) {
    console.warn(`[parse] ${errors.length} linhas rejeitadas em ${context.tab}`, errors.slice(0, 3));
  }
  if (parsed.length === 0 && rows.length > 0) {
    throw new Error(
      `[${context.tab}] todas as ${rows.length} linhas falharam validação. Verifique schema.`
    );
  }
  return parsed;
}
