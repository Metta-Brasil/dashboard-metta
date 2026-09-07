import { NextResponse, type NextRequest } from "next/server";
import {
  hasProblems,
  refreshProblems,
} from "@/app/api/_lib/refresh-status";
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
    const { refreshed, persisted, durationMs } = await refreshAllSheets();
    // Aba que não persistiu = cache velho servido em produção. Responder 200
    // aqui deixava o cron horário verde enquanto o dashboard mostrava dado
    // desatualizado; o 409 faz o workflow falhar e aparecer.
    const problemas = refreshProblems(persisted);
    const ruim = hasProblems(problemas);
    if (ruim) {
      console.error("[revalidate] abas com cache velho", problemas);
    }
    return NextResponse.json(
      {
        ok: !ruim,
        refreshed,
        persisted,
        ...problemas,
        durationMs,
        at: new Date().toISOString(),
      },
      { status: ruim ? 409 : 200 }
    );
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
