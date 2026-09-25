import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { issuerFreezeStatus } from "@/lib/issuer";

/**
 * GET /api/issuer/[address] — has Tether, the issuer of USDT, frozen this
 * address? Read from the USDT contract's own blacklist, on TRON or Ethereum.
 *
 * Built for money at rest in a private wallet, where no exchange can be asked
 * to act and the issuer is the one party that still can. `status` is `frozen`,
 * `not-frozen`, or `unchecked` when the chain did not answer — never a guess.
 * The answer is the chain as it stands now, stamped with `checkedAt` and the
 * SHA-256 of the response it was read from. Reads one value; writes nothing.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/issuer/[address]">,
) {
  const { address: raw } = await ctx.params;
  const check = checkAddress(decodeURIComponent(raw));
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  const status = await issuerFreezeStatus(check.address);
  return NextResponse.json(
    {
      ...status,
      note:
        status.status === "frozen"
          ? "Frozen by the issuer: this address cannot move USDT. What it held stays where it is unless the issuer lifts the freeze."
          : status.status === "not-frozen"
            ? "Not frozen by the issuer as of the time above. The issuer can freeze USDT at any address, which does not depend on an exchange."
            : "Not checked. Nothing is stated about this address.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
