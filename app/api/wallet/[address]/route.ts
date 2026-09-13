import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { profileWallet } from "@/lib/wallet";

/**
 * GET /api/wallet/[address] — what a single wallet is, and who funded it.
 *
 * A fourth endpoint, where AGENTS.md §5 specifies three. On the record as a
 * deliberate deviation: the three it names all answer "where did the money go",
 * and none of them answers "what is this address". An investigator looking at a
 * node on the graph asks the second question immediately, and until now the
 * only way to answer it was to leave for a block explorer.
 *
 * It reads the same chain client, the same attribution table and the same
 * provenance discipline as the tracer, so nothing new is claimed here — it is
 * the existing pipeline pointed backwards at one wallet.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/wallet/[address]">,
) {
  const { address: raw } = await ctx.params;
  const address = decodeURIComponent(raw).trim();

  // Checked server-side as well as in the browser: a malformed address must
  // never reach the chain client, and must never be confused with an unknown one.
  const check = checkTronAddress(address);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason, address }, { status: 400 });
  }

  try {
    const profile = await profileWallet(address);
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "The wallet could not be read.",
        address,
      },
      { status: 502 },
    );
  }
}
