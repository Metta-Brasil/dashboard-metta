import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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
