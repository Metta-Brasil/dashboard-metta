import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { SHEETS_CACHE_TAG } from "@/lib/sheets/read";

/**
 * Vercel Cron handler — invoked every 10 minutes (see /vercel.json).
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` for
 * production cron jobs. We require the same header here so the endpoint
 * is not freely invocable.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");

  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Next 16 requires a profile (or inline expire config) as the 2nd arg.
  // "default" matches the in-cache cacheLife profile we use elsewhere.
  revalidateTag(SHEETS_CACHE_TAG, "default");

  return NextResponse.json({
    ok: true,
    revalidatedAt: new Date().toISOString(),
  });
}
