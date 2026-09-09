import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { runTrace } from "@/lib/tracer";

/**
 * GET /api/trace/[address] — the shareable permalink for a trace. AGENTS.md §5.
 *
 * The amount and the fraud date are not in the URL, so this re-runs the trace
 * with a full lookback and the reported amount defaulted to the total that left
 * the address. That makes a permalink openable by anyone the case is sent to,
 * at the cost of a wider window than the original run.
 *
 * `?amount=` and `?since=` narrow it back to the officer's original parameters.
 */
export const dynamic = "force-dynamic";

/** Reported amount is only used for the dust floor and the taint denominator. */
const DEFAULT_AMOUNT = 1;
/** With no fraud date, look back a year rather than to genesis. */
const DEFAULT_LOOKBACK_DAYS = 365;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/trace/[address]">,
) {
  const { address: raw } = await ctx.params;
  const address = decodeURIComponent(raw).trim();

  const check = checkTronAddress(address);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const url = new URL(request.url);
  const amountParam = Number(url.searchParams.get("amount"));
  const sinceParam = url.searchParams.get("since");

  const amount =
    Number.isFinite(amountParam) && amountParam > 0 ? amountParam : DEFAULT_AMOUNT;
  const since = sinceParam ? new Date(sinceParam) : new Date(NaN);
  const fraudDate = Number.isNaN(since.getTime())
    ? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86_400_000)
    : since;

  try {
    const result = await runTrace({
      address,
      amount,
      fraudDate: fraudDate.toISOString(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "The trace could not be completed.",
      },
      { status: 502 },
    );
  }
}
