import { google, type sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

let cachedClient: sheets_v4.Sheets | null = null;

/**
 * Returns a memoized, read-only Google Sheets API v4 client authenticated
 * via Service Account (JWT). Throws if required env vars are missing.
 *
 * `GOOGLE_SHEETS_PRIVATE_KEY` is normalized so it works whether stored as a
 * multi-line value (local .env) or a single-line value with escaped \n (Vercel).
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail) {
    throw new Error(
      "GOOGLE_SHEETS_CLIENT_EMAIL is not set. Configure the Service Account email in env vars.",
    );
  }
  if (!rawPrivateKey) {
    throw new Error(
      "GOOGLE_SHEETS_PRIVATE_KEY is not set. Configure the Service Account private key in env vars.",
    );
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/**
 * Returns the configured spreadsheet ID. Throws if missing.
 */
export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_SHEETS_ID is not set. Configure the source spreadsheet ID in env vars.",
    );
  }
  return id;
}
