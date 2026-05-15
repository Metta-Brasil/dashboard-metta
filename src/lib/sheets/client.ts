import { google } from "googleapis";

/**
 * Normaliza PRIVATE_KEY:
 * - Remove aspas wrapping (algumas UIs/CLIs adicionam ao salvar)
 * - Converte \n literal em newline real (formato Vercel)
 */
function normalizeKey(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\n/g, "\n");
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.replace(/^["']|["']$/g, ""),
  key: normalizeKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

export const sheetsClient = google.sheets({ version: "v4", auth });

export const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID ?? "";

export function assertSheetsEnv(): void {
  const missing: string[] = [];
  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) missing.push("GOOGLE_SHEETS_CLIENT_EMAIL");
  if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) missing.push("GOOGLE_SHEETS_PRIVATE_KEY");
  if (!process.env.GOOGLE_SHEETS_ID) missing.push("GOOGLE_SHEETS_ID");
  if (missing.length > 0) {
    throw new Error(`Sheets env vars ausentes: ${missing.join(", ")}`);
  }
}
