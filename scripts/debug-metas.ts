/**
 * Debug: o que a Sheets API devolve pra Metas!A:D (mesmas opções do app)
 * e o que o schema produz. Uso: npx tsx scripts/debug-metas.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const re =
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.|\n|\r)*"|'(?:[^'\\]|\\.|\n|\r)*'|[^\r\n]*)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1];
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
      if (m[2]?.startsWith('"'))
        val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}
loadEnvLocal();

import { MetaRowSchema, METAS_COLUMN_MAP } from "@/lib/sheets/schemas";
import { parseSheetData } from "@/lib/sheets/parse";

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEETS_ID ?? "";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: "Metas!A:D",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values = res.data.values ?? [];
  console.log("=== RAW (", values.length, "linhas) ===");
  values.forEach((r, i) =>
    console.log(
      i,
      JSON.stringify(r),
      r.map((c) => typeof c).join(",")
    )
  );

  console.log("\n=== parseSheetData ===");
  const parsed = parseSheetData(MetaRowSchema, values, METAS_COLUMN_MAP, {
    tab: "Metas",
  });
  console.log("parsed rows:", parsed.length);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
