import { NextResponse, type NextRequest } from "next/server";
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
  const auth = req.headers.get("authorization");
  const xrs = req.headers.get("x-revalidate-secret");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (revalidateSecret && auth === `Bearer ${revalidateSecret}`) return true;
  if (revalidateSecret && xrs === revalidateSecret) return true;
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
    // fb_todos é a aba crítica (todo custo/tráfego depende dela). Se
    // não persistiu, devolve 500 pro cron externo alarmar — em vez de
    // “ok” mentiroso enquanto o cache fica velho silenciosamente.
    const fb = persisted["fb_todos"];
    const fbOk = Boolean(fb && (fb.ok || fb.skipped));
    return NextResponse.json(
      {
        ok: fbOk,
        refreshed,
        persisted,
        durationMs,
        at: new Date().toISOString(),
      },
      { status: fbOk ? 200 : 500 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
