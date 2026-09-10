import { NextResponse } from "next/server";
import { checkTronAddress } from "@/lib/tron";
import { runTrace, type TraceRequest } from "@/lib/tracer";
import { streamTrace, wantsStream } from "@/lib/trace-stream";
import { DEMO_MODE, frozenTrace } from "@/lib/demo";

/**
 * POST /api/trace — run a live trace. AGENTS.md §5.
 *
 * Body: { address, amount, fraudDate }
 *
 * This reads the chain on every call, so it is deliberately dynamic and never
 * cached: a trace answers "where is the money now", and a cached answer to that
 * question is worse than no answer.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { address, amount, fraudDate } = (body ?? {}) as {
    address?: unknown;
    amount?: unknown;
    fraudDate?: unknown;
  };

  if (typeof address !== "string") {
    return NextResponse.json({ error: "address is required." }, { status: 400 });
  }

  // Checked server-side too. The browser checks it to save a round trip, not to
  // be trusted.
  const check = checkTronAddress(address);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  // Both optional. A blank amount traces everything that left the wallet; a
  // blank date opens the window at the wallet's own first transfer. Only a value
  // that was given and is malformed is refused.
  const amountGiven =
    amount !== undefined && amount !== null && String(amount).trim() !== "";
  const value = amountGiven ? Number(amount) : Number.NaN;
  if (amountGiven && (!Number.isFinite(value) || value <= 0)) {
    return NextResponse.json(
      { error: "amount, when given, must be a positive number of USDT." },
      { status: 400 },
    );
  }

  const dateGiven = typeof fraudDate === "string" && fraudDate.trim() !== "";
  const when = dateGiven ? new Date(fraudDate as string) : new Date(Number.NaN);
  if (dateGiven && Number.isNaN(when.getTime())) {
    return NextResponse.json(
      { error: "fraudDate, when given, must be a valid date." },
      { status: 400 },
    );
  }

  const job: TraceRequest = {
    address: address.trim(),
    amount: amountGiven ? value : "auto",
    fraudDate: dateGiven ? when.toISOString() : "auto",
  };

  // Demo mode, AGENTS.md §10. Served only for an address we actually hold a
  // frozen case for — anything else still goes to the chain, because serving
  // one address's recorded trace for another is the one lie that would make
  // every other number on the screen worthless. The header is what stops the
  // interface calling this live.
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

  if (wantsStream(request)) {
    return streamTrace((emit) => runTrace(job, emit), "live");
  }

  try {
    const result = await runTrace(job);
    return NextResponse.json(result, {
      headers: { "x-finex-provenance": "live" },
    });
  } catch (err) {
    // A trace that fails must say so rather than returning a half-built result
    // the interface would render as a finding.
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "The trace could not be completed.",
      },
      { status: 502 },
    );
  }
}
