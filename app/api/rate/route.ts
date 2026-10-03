import { NextResponse } from "next/server";
import { inrEnabled, readInrRate } from "@/lib/inr";

/**
 * GET /api/rate — the USDT/INR rate, read live from an Indian exchange's
 * public ticker (lib/inr.ts), with its source and the time it was read. Kept
 * five minutes server-side. `{ rate: null }` when no exchange answered or the
 * deployment turned it off; the screen then shows no rupee figure at all.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const rate = await readInrRate();
  return NextResponse.json(
    rate ?? { rate: null, reason: inrEnabled() ? "No Indian exchange answered." : "Turned off on this deployment." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
