import { NextResponse, type NextRequest } from "next/server";
import {
  hasProblems,
  refreshProblems,
} from "@/app/api/_lib/refresh-status";
import { bearerToken, secretMatches } from "@/app/api/_lib/secret";
import { refreshAllSheets } from "@/lib/sheets/read";

export const maxDuration = 120;

/**
 * Refresh do cache (Upstash). Chamado pelo cron externo horário
 * (GitHub Actions — .github/workflows/refresh-cache.yml) e compatível
 * com Vercel Cron (Authorization: Bearer CRON_SECRET).
 *
 * Busca fresco da Sheets e sobrescreve o Upstash → cache sempre quente
 * e ≤1h de idade. Aceita CRON_SECRET ou REVALIDATE_SECRET.
 */
function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  const bearer = bearerToken(req.headers.get("authorization"));
  const xrs = req.headers.get("x-revalidate-secret");
  // Os DOIS segredos continuam valendo de propósito: o Vercel Cron manda
  // CRON_SECRET e o workflow .github/workflows/refresh-cache.yml usa
  // REVALIDATE_SECRET. Aceitar só um quebra o refresh horário do cache.
  if (secretMatches(cronSecret, bearer)) return true;
  if (secretMatches(revalidateSecret, bearer)) return true;
  if (secretMatches(revalidateSecret, xrs)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  try {
    const { refreshed, persisted, durationMs } = await refreshAllSheets();
    // Qualquer aba que não persistiu deixa o cache velho no ar. Antes só
    // fb_todos era conferida e, pior, `skipped` contava como sucesso —
    // exatamente o caso da trava anti-clobber, que é o mais silencioso.
    const problemas = refreshProblems(persisted);
    const ruim = hasProblems(problemas);
    if (ruim) {
      console.error("[cron] abas com cache velho", problemas);
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
      { status: ruim ? 500 : 200 }
    );
  } catch (err) {
    // Detalhe só no log: erro da googleapis carrega spreadsheetId, range
    // e às vezes o e-mail da service account — nada disso vai na resposta.
    console.error("[cron] refresh falhou", err);
    return NextResponse.json(
      { ok: false, error: "refresh failed" },
      { status: 500 }
    );
  }
}
