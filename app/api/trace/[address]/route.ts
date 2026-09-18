import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { runTrace, type TraceRequest } from "@/lib/tracer";
import { streamTrace, wantsStream } from "@/lib/trace-stream";
import { DEMO_MODE, answersFor, frozenTrace } from "@/lib/demo";

/**
 * GET /api/trace/[address] — the shareable permalink for a trace. AGENTS.md §5.
 *
 * A bare permalink re-runs the trace over the wallet's full visible history and
 * adopts everything that left the address as the amount, so it answers "what
 * does this wallet look like now". A link made inside the app also carries
 * `?amount=` and `?since=` — the run it came from — so it replays that run
 * exactly, and `?asof=` pins it to the moment that run was read, so it shows
 * the same case on any later day. `?model=fifo` traces under
 * first-in-first-out instead of haircut.
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

  const url = new URL(request.url);
  /* ?model=fifo runs the same trace under first-in-first-out instead of the
     proportional haircut. Anything else, including nothing, is haircut — the
     model that shipped, so an existing link is unaffected. */
  const model = url.searchParams.get("model") === "fifo" ? ("fifo" as const) : undefined;

  const amountParam = Number(url.searchParams.get("amount"));
  const sinceParam = url.searchParams.get("since");

  // No amount in a permalink, so adopt whatever actually left the address.
  const amount: number | "auto" =
    Number.isFinite(amountParam) && amountParam > 0 ? amountParam : "auto";
  const since = sinceParam ? new Date(sinceParam) : new Date(Number.NaN);

  const asofParam = url.searchParams.get("asof");
  const asOf = asofParam ? new Date(asofParam) : null;
  if (asOf && (Number.isNaN(asOf.getTime()) || asOf.getTime() > Date.now())) {
    return NextResponse.json(
      { error: "asof, when given, must be a valid moment in the past." },
      { status: 400 },
    );
  }

  // No date: open the window at the wallet's own first transfer.
  const job: TraceRequest = {
    address,
    amount,
    fraudDate: Number.isNaN(since.getTime()) ? "auto" : since.toISOString(),
    ...(model ? { model } : {}),
    ...(asOf ? { asOf: asOf.toISOString() } : {}),
  };

  /*
   * Exact-address match only, and only for the run the case recorded — see
   * `answersFor`. A request for FIFO is by definition not that run: returning
   * the haircut capture would label a haircut figure as FIFO, which is the one
   * kind of lie this file exists to prevent, so it goes to the chain like any
   * other and fails honestly if the network is gone.
   */
  if (DEMO_MODE) {
    const held = frozenTrace(address);
    if (held && answersFor(held.trace, job)) {
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
