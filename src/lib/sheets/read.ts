import { cacheLife, cacheTag } from "next/cache";
import { getSheetsClient, getSpreadsheetId } from "./client";
import {
  FbTodosRowSchema,
  LeadsRowSchema,
  SdrRowSchema,
  VendasRowSchema,
  parseRows,
  type FbTodosRow,
  type LeadsRow,
  type SdrRow,
  type VendasRow,
} from "./schemas";

export type SheetTab = "fb_todos" | "leads" | "sdr" | "vendas";

export const SHEETS_CACHE_TAG = "sheets-data";

// Default range per tab. Kept narrow (not A:Z) to stay under the Sheets API
// 10MB response limit — fb_todos is the big one (~51k rows).
const TAB_RANGES: Record<SheetTab, string> = {
  fb_todos: "fb_todos!A:R",
  leads: "leads!A:Z",
  sdr: "sdr!A:Z",
  vendas: "vendas!A:Z",
};

// Type-level dispatch so callers get the right row type back per tab.
export type SheetRowOf<T extends SheetTab> = T extends "fb_todos"
  ? FbTodosRow
  : T extends "leads"
    ? LeadsRow
    : T extends "sdr"
      ? SdrRow
      : T extends "vendas"
        ? VendasRow
        : never;

/**
 * Reads and parses a single tab from the source spreadsheet.
 *
 * Cached server-side via Next 16 Cache Components:
 *   - revalidate: 600s (10 min) — matches the Vercel Cron warmup cadence.
 *   - expire:     3600s (1 h)   — hard ceiling; after this, next request
 *                                 waits for fresh data synchronously.
 *   - tag:        "sheets-data" — single tag for all tabs so the cron
 *                                 invalidates them in one call.
 *
 * Values are requested as UNFORMATTED_VALUE / SERIAL_NUMBER, so dates arrive
 * as Sheets serial numbers (see utils.sheetSerialToDate) and numbers stay
 * numeric (no thousand-separator strings to clean up).
 */
export async function readSheet<T extends SheetTab>(
  tab: T,
): Promise<SheetRowOf<T>[]> {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag(SHEETS_CACHE_TAG);

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const range = TAB_RANGES[tab];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const rawRows = (res.data.values ?? []) as unknown[][];

  switch (tab) {
    case "fb_todos":
      return parseRows(rawRows, FbTodosRowSchema) as SheetRowOf<T>[];
    case "leads":
      return parseRows(rawRows, LeadsRowSchema) as SheetRowOf<T>[];
    case "sdr":
      return parseRows(rawRows, SdrRowSchema) as SheetRowOf<T>[];
    case "vendas":
      return parseRows(rawRows, VendasRowSchema) as SheetRowOf<T>[];
    default: {
      // Exhaustiveness guard
      const _exhaustive: never = tab;
      throw new Error(`Unknown sheet tab: ${String(_exhaustive)}`);
    }
  }
}
