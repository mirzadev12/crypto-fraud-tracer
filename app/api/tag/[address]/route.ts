import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { readTronTag, tagsEnabled } from "@/lib/explorer-tag-live";
import { limited } from "@/lib/rate-limit";

/**
 * GET /api/tag/[address] — a TRON address's public explorer tag, read live
 * (lib/explorer-tag-live.ts). An annotation for the wallets past a trace's
 * search limit, never an attribution. 502 when the explorer did not answer,
 * which is not the same as "no tag".
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/tag/[address]">) {
  const refused = limited(request, "read");
  if (refused) return refused;
  const { address: raw } = await ctx.params;
  const check = checkAddress(decodeURIComponent(raw).trim());
  if (!check.valid || check.chain !== "tron") {
    return NextResponse.json({ error: "Explorer tags are read for TRON addresses only." }, { status: 400 });
  }
  if (!tagsEnabled()) {
    return NextResponse.json({ error: "Explorer tags are off on this deployment." }, { status: 503 });
  }
  const tag = await readTronTag(check.address);
  if (!tag) return NextResponse.json({ error: "The explorer did not answer." }, { status: 502 });
  return NextResponse.json(tag, { headers: { "Cache-Control": "no-store" } });
}
