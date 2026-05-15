import { NextResponse, type NextRequest } from "next/server";
import { refreshAllSheets } from "@/lib/sheets/read";

export const maxDuration = 120;

/**
 * Refresh manual do cache (Upstash). Busca fresco da Sheets e sobrescreve.
 * Protegido por REVALIDATE_SECRET no header `x-revalidate-secret`.
 * Também aceito como alvo do cron externo (GitHub Actions).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const provided =
    req.headers.get("x-revalidate-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/, "");

  if (!expected || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { refreshed, durationMs } = await refreshAllSheets();
    return NextResponse.json({
      ok: true,
      refreshed,
      durationMs,
      at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
