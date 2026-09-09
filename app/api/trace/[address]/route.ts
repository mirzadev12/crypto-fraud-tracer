import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { runTrace } from "@/lib/tracer";

/**
 * GET /api/trace/[address] — the shareable permalink for a trace. AGENTS.md §5.
 *
 * The amount and the fraud date are not in the URL, so this re-runs the trace
 * over a year-long window and adopts everything that left the address as the
 * reported amount. A permalink is therefore "what does this wallet look like
 * now", not a replay of one officer's parameters — the frozen numbers from the
 * original run live in that case's evidence packet.
 *
 * `?amount=` and `?since=` narrow it back to the officer's original parameters.
 */
export const dynamic = "force-dynamic";


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

  // No amount in a permalink, so adopt whatever actually left the address.
  const amount: number | "auto" =
    Number.isFinite(amountParam) && amountParam > 0 ? amountParam : "auto";
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
