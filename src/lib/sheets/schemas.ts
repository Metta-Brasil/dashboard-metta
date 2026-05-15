import { z } from "zod";

/**
 * Schemas for the four source tabs in the "BASE DE DADOS - PALIATIVO" spreadsheet.
 *
 * Column names below match the planilha conventions inferred from the plan
 * (see ~/.claude/plans/u-vamos-l-eu-resilient-scroll.md):
 *
 *   - fb_todos.C   = "PERP+CAPT+<funil>" conversion classifier
 *   - leads.I      = funil
 *   - sdr.K        = status (e.g. "Realizada")
 *   - vendas.K     = funil
 *
 * The full column set is not yet locked down, so most fields are tolerant
 * (optional / nullable). Critical fields used by the analytics layer are
 * required and properly typed. Header parsing is case-insensitive and tolerant
 * to whitespace via `normalizeHeader` below.
 */

// ---------- fb_todos ----------

export const FbTodosRowSchema = z.object({
  data: z.union([z.number(), z.string()]).nullable().optional(),
  conversao: z.string().optional().default(""), // col C ("PERP+CAPT+<funil>")
  campaign: z.string().optional().default(""),
  adset: z.string().optional().default(""),
  ad: z.string().optional().default(""),
  utm_content: z.string().optional().default(""),
  spend: z.union([z.number(), z.string()]).nullable().optional(),
  impressions: z.union([z.number(), z.string()]).nullable().optional(),
  clicks: z.union([z.number(), z.string()]).nullable().optional(),
});
export type FbTodosRow = z.infer<typeof FbTodosRowSchema>;

// ---------- leads ----------

export const LeadsRowSchema = z.object({
  data: z.union([z.number(), z.string()]).nullable().optional(),
  funil: z.string().optional().default(""), // col I
  origem: z.string().optional().default(""),
  qualificacao: z.string().optional().default(""), // Enterprise / MQL1 / MQL2
  email: z.string().optional().default(""),
});
export type LeadsRow = z.infer<typeof LeadsRowSchema>;

// ---------- sdr ----------

export const SdrRowSchema = z.object({
  data: z.union([z.number(), z.string()]).nullable().optional(),
  sdr: z.string().optional().default(""),
  status: z.string().optional().default(""), // col K ("Realizada", etc.)
  lead_id: z.string().optional().default(""),
});
export type SdrRow = z.infer<typeof SdrRowSchema>;

// ---------- vendas ----------

export const VendasRowSchema = z.object({
  data: z.union([z.number(), z.string()]).nullable().optional(),
  funil: z.string().optional().default(""), // col K
  closer: z.string().optional().default(""),
  valor: z.union([z.number(), z.string()]).nullable().optional(),
});
export type VendasRow = z.infer<typeof VendasRowSchema>;

// ---------- helpers ----------

/**
 * Lower-cases, trims, removes accents, and collapses non-alphanumeric runs
 * to a single underscore. Used so that header cells like "Conversão", "UTM
 * Content " or "Lead ID" all map to canonical schema keys.
 */
function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generic row parser:
 *   1. Reads the header row (default: row 0).
 *   2. For every subsequent row, builds an object keyed by normalized headers.
 *   3. Runs schema.safeParse on it. Failures are logged with the row index
 *      and dropped — we never abort the whole sheet for a single bad row.
 */
export function parseRows<T>(
  rawRows: unknown[][],
  schema: z.ZodSchema<T>,
  headerRow: number = 0,
): T[] {
  if (!Array.isArray(rawRows) || rawRows.length <= headerRow) return [];

  const headerCells = rawRows[headerRow] ?? [];
  const headers = headerCells.map((h) => normalizeHeader(h));

  const out: T[] = [];
  for (let i = headerRow + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c];
    }

    const parsed = schema.safeParse(obj);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      // Tolerant: log and drop. Do not throw so a single malformed row
      // does not nuke the entire snapshot.
      console.warn(
        `[sheets.parseRows] row ${i} failed validation`,
        parsed.error.issues,
      );
    }
  }
  return out;
}
