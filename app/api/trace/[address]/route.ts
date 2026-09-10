import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { runTrace, type TraceRequest } from "@/lib/tracer";
import { streamTrace, wantsStream } from "@/lib/trace-stream";
import { DEMO_MODE, frozenTrace } from "@/lib/demo";

/**
 * GET /api/trace/[address] — the shareable permalink for a trace. AGENTS.md §5.
 *
 * The amount and the fraud date are not in the URL, so this re-runs the trace
 * over the wallet's full visible history and adopts everything that left the address as the
 * reported amount. A permalink is therefore "what does this wallet look like
 * now", not a replay of one officer's parameters — the frozen numbers from the
 * original run live in that case's evidence packet.
 *
 * `?amount=` and `?since=` narrow it back to the officer's original parameters.
 */
export const dynamic = "force-dynamic";



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

  // See the POST route: exact-address match only, and the response says so.
  if (DEMO_MODE) {
    const held = frozenTrace(address);
    if (held) {
      if (wantsStream(request)) {
        return streamTrace(async (emit) => {
          emit({ type: "recorded", caseId: held.trace.caseId });
          return held.trace;
        }, "recorded");
      }
      return NextResponse.json(held.trace, {
        headers: { "x-finex-provenance": "recorded" },
      });
    }
  }

  const url = new URL(request.url);
  const amountParam = Number(url.searchParams.get("amount"));
  const sinceParam = url.searchParams.get("since");

  // No amount in a permalink, so adopt whatever actually left the address.
  const amount: number | "auto" =
    Number.isFinite(amountParam) && amountParam > 0 ? amountParam : "auto";
  const since = sinceParam ? new Date(sinceParam) : new Date(Number.NaN);
  // No date: open the window at the wallet's own first transfer.
  const job: TraceRequest = {
    address,
    amount,
    fraudDate: Number.isNaN(since.getTime()) ? "auto" : since.toISOString(),
  };

  if (wantsStream(request)) {
    return streamTrace((emit) => runTrace(job, emit), "live");
  }

  try {
    const result = await runTrace(job);
    return NextResponse.json(result, {
      headers: { "x-finex-provenance": "live" },
    });
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
