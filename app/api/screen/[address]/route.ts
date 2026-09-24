import { NextResponse } from "next/server";
import { screenAddress } from "@/lib/screen";

/**
 * GET /api/screen/[address] — is this address, on any chain, OFAC-listed?
 *
 * A fifth endpoint, and like `/api/wallet` a deliberate deviation from the three
 * AGENTS.md §5 names. Those three follow money on TRON. This one answers for an
 * address on any chain the OFAC SDN list covers, because the problem statement
 * asks the system to support multiple blockchain ecosystems and a complaint does
 * not choose its chain. It reads no chain and makes no inference: an exact match
 * against a committed copy of the list, stamped with the date OFAC published it.
 *
 * Listed is a finding. Not listed is not a clearance, and the response says so
 * in `note` so that no integrator can read an empty `listing` as "clean".
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/screen/[address]">,
) {
  const { address: raw } = await ctx.params;
  const address = decodeURIComponent(raw).trim();
  if (!address || address.length > 128 || /\s/.test(address)) {
    return NextResponse.json({ error: "Not an address.", address }, { status: 400 });
  }

  const result = screenAddress(address);
  return NextResponse.json(
    {
      ...result,
      note: result.listing
        ? "Listed on the OFAC SDN list. Confirm against the current list before acting."
        : "Not on the OFAC SDN list as published on the date above. That is not a clearance: OFAC lists only some of the addresses a designated party controls.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
