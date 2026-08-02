import { NextResponse, type NextRequest } from "next/server";
import { bearerToken, secretMatches } from "@/app/api/_lib/secret";
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
    bearerToken(req.headers.get("authorization"));

  // Rota fora do middleware: o segredo é a única barreira, então a
  // comparação é em tempo constante. Sem env definida → 401 (fail-closed).
  if (!secretMatches(expected, provided)) {
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
    // Detalhe só no log: erro da googleapis carrega spreadsheetId, range
    // e às vezes o e-mail da service account — nada disso vai na resposta.
    console.error("[revalidate] refresh falhou", err);
    return NextResponse.json(
      { ok: false, error: "refresh failed" },
      { status: 500 }
    );
  }
}
