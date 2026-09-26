import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { runTrace, type TraceRequest } from "@/lib/tracer";
import { streamTrace, wantsStream } from "@/lib/trace-stream";
import { DEMO_MODE, answersFor, frozenTrace } from "@/lib/demo";
import type { TraceRun } from "@/lib/audit";
import { recordTrace } from "@/lib/audit-store";

/**
 * POST /api/trace — run a live trace. AGENTS.md §5.
 *
 * Body: { address, amount?, fraudDate?, model?, asOf? }
 *
 * `model: "fifo"` traces under first-in-first-out instead of the proportional
 * haircut, exactly as `?model=fifo` does on the permalink.
 *
 * `asOf` reads the chain as it stood at that moment. It exists so a recorded
 * case can be re-derived after a rule changes (`scripts/rescore-cases.mjs`);
 * an investigator never needs it, and the interface never sends it.
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

  const { address, amount, fraudDate, model, asOf } = (body ?? {}) as {
    address?: unknown;
    amount?: unknown;
    fraudDate?: unknown;
    model?: unknown;
    asOf?: unknown;
  };

  if (typeof address !== "string") {
    return NextResponse.json({ error: "address is required." }, { status: 400 });
  }

  // Checked server-side too. The browser checks it to save a round trip, not to
  // be trusted.
  const check = checkAddress(address);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  // One spelling per wallet: an Ethereum address is case-insensitive on the
  // chain, and a recorded case is matched on the exact string.
  const subject = check.address;

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

  const asOfGiven = typeof asOf === "string" && asOf.trim() !== "";
  const asOfAt = asOfGiven ? new Date(asOf as string) : new Date(Number.NaN);
  if (asOfGiven && (Number.isNaN(asOfAt.getTime()) || asOfAt.getTime() > Date.now())) {
    return NextResponse.json(
      { error: "asOf, when given, must be a valid moment in the past." },
      { status: 400 },
    );
  }

  const job: TraceRequest = {
    address: subject,
    amount: amountGiven ? value : "auto",
    fraudDate: dateGiven ? when.toISOString() : "auto",
    ...(model === "fifo" ? { model: "fifo" as const } : {}),
    ...(asOfGiven ? { asOf: asOfAt.toISOString() } : {}),
  };

  // What was asked, for the audit log: every answer below is recorded with it.
  const run: TraceRun = { amount: job.amount, fraudDate: job.fraudDate, model: job.model ?? "haircut" };

  // Demo mode, AGENTS.md §10. Served only for an address we actually hold a
  // frozen case for, and only when the run asked for is the run it recorded —
  // anything else still goes to the chain, because serving one run's recorded
  // trace for another is the one lie that would make every other number on the
  // screen worthless. The header is what stops the interface calling this live.
  if (DEMO_MODE) {
    const held = frozenTrace(subject);
    if (held && answersFor(held.trace, job)) {
      await recordTrace(request, held.trace, run, "recorded");
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
    return streamTrace(async (emit) => {
      const result = await runTrace(job, emit);
      await recordTrace(request, result, run, "live");
      return result;
    }, "live");
  }

  try {
    const result = await runTrace(job);
    await recordTrace(request, result, run, "live");
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
