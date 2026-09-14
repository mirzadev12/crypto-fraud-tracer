import { NextResponse } from "next/server";
import { resolveTxHash } from "@/lib/txlookup";

/**
 * GET /api/tx/[hash] — what wallet did this transaction send USDT to?
 *
 * The intake screen calls this when what an officer holds is a transaction
 * rather than an address, which is the ordinary case: a complainant cannot
 * produce a wallet, but their exchange can produce the withdrawal that created
 * one. Resolving it here rather than in the browser keeps the chain client, the
 * contract address and the decimals in one place.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/tx/[hash]">,
) {
  const { hash } = await ctx.params;
  const lookup = await resolveTxHash(decodeURIComponent(hash));

  // "Not a hash" is the caller's mistake; everything else is a fact about the
  // transaction and is reported with 200 so the screen can state it plainly.
  if (lookup.status === "not-a-hash") {
    return NextResponse.json(lookup, { status: 400 });
  }
  return NextResponse.json(lookup);
}
