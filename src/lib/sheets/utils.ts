/**
 * Converts a Google Sheets serial date number into a JS Date.
 *
 * Google Sheets uses the Lotus 1-2-3 epoch of 1899-12-30. Subtracting 25569
 * shifts it to the Unix epoch (1970-01-01), then we multiply by seconds per
 * day and 1000 to get milliseconds.
 *
 * Returns null for non-numeric / empty values so parsers can skip them
 * without throwing.
 */
export function sheetSerialToDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
}

/**
 * Normalizes any cell value to a trimmed string. Empty cells become "".
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Coerces a cell to a finite number, returning null when it cannot be parsed.
 * Tolerates Brazilian "1.234,56" formats by stripping thousand separators and
 * swapping the decimal comma.
 */
export function cellToNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Handle BR formatted numbers: "1.234,56" -> "1234.56"
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
