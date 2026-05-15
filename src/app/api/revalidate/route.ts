import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { SHEETS_CACHE_TAG } from "@/lib/sheets/read";

/**
 * Manual cache invalidation endpoint.
 *
 * Used for debug / ad-hoc refresh outside the cron cadence. Protected by a
 * shared secret in the `x-revalidate-secret` header.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const provided = req.headers.get("x-revalidate-secret");

  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Next 16 requires a profile (or inline expire config) as the 2nd arg.
  revalidateTag(SHEETS_CACHE_TAG, "default");

  return NextResponse.json({
    ok: true,
    revalidatedAt: new Date().toISOString(),
  });
}
