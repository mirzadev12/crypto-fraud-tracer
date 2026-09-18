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

  /**
   * A frozen case answers only for the run it actually is.
   *
   * A pinned link carries the figures of the run it came from, so a link made
   * inside the app always matches and is still served from the file. A link
   * asking for a *different* amount or window is asking a question the recorded
   * case cannot answer — serving it anyway would print the captured figures
   * under someone else's parameters, which is the same class of lie as
   * answering for an address the case does not belong to. Those go to the chain
   * like any other request and fail honestly when the network is gone.
   *
   * No parameters means "the recorded run", which is what a bare permalink to a
   * recorded case has always meant.
   */
  const matchesFrozen = (frozen: { reportedAmountUsdt: number; fraudDate: string }) => {
    if (amount !== "auto" && Math.abs(amount - frozen.reportedAmountUsdt) > 0.005) {
      return false;
    }
    if (!Number.isNaN(since.getTime())) {
      const recorded = new Date(frozen.fraudDate).getTime();
      if (Number.isNaN(recorded) || since.getTime() !== recorded) return false;
    }
    return true;
  };

  /*
   * See the POST route: exact-address match only, and the response says so.
   *
   * A frozen case was captured under haircut, so it cannot answer a request for
   * a different model — returning it would label a haircut figure as FIFO,
   * which is the one kind of lie this file exists to prevent. A model request
   * therefore goes to the chain like any other address, and fails honestly if
   * the network is gone.
   */
  if (DEMO_MODE && !model) {
    const held = frozenTrace(address);
    if (held && matchesFrozen(held.trace)) {
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

  // No date: open the window at the wallet's own first transfer.
  const job: TraceRequest = {
    address,
    amount,
    fraudDate: Number.isNaN(since.getTime()) ? "auto" : since.toISOString(),
    ...(model ? { model } : {}),
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
