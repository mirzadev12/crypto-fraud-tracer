import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { tracePayers } from "@/lib/payers";

/**
 * GET /api/payers/[address] — who paid a wallet, and where each payer's USDT
 * came from, one hop back (lib/payers.ts).
 *
 * A separate endpoint from /api/wallet because it costs up to twenty more chain
 * reads: the wallet card asks for it only when an officer does. Like the other
 * routes it reads through the same chain client and attribution table, and
 * states an unreadable wallet as unreadable.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/payers/[address]">,
) {
  const { address: raw } = await ctx.params;
  const typed = decodeURIComponent(raw).trim();
  const check = checkAddress(typed);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason, address: typed }, { status: 400 });
  }
  try {
    return NextResponse.json(await tracePayers(check.address));
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "The payers could not be read.",
        address: check.address,
      },
      { status: 502 },
    );
  }
}
