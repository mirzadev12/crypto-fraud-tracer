/**
 * The safety net. AGENTS.md §10.
 *
 * The public chain endpoint rate-limits, venue wifi drops, and a live trace
 * takes half a minute on a good day. Teams lose finals to that. So three real
 * addresses were run through the live pipeline, and their complete results —
 * including the SHA-256 of every API response they were built from — are frozen
 * into `data/demo-cases.json`.
 *
 * This is not staged data. Every figure in a frozen case was computed by
 * `lib/tracer.ts` from real transfers read from the chain on the date recorded
 * in the file. What demo mode removes is the network, not the evidence.
 *
 * Three rules govern it, and all come from CONTEXT.md §3:
 *
 *  1. **A frozen trace is never served for an address it does not belong to.**
 *     The lookup is by exact address. If demo mode is on and the address is not
 *     in the file, the request goes to the chain like any other — and if the
 *     network is gone, it fails honestly. The moment a demo answers for an
 *     address it does not hold, nothing else on screen can be trusted.
 *  2. **A frozen trace never claims to be live.** The route stamps
 *     `x-finex-provenance: recorded` on it, `lib/api.ts` reads that header, and
 *     the screen shows RECORDED TRACE rather than LIVE TRACE.
 *  3. **A frozen trace answers only for the run it is.** See `answersFor`.
 *
 * The file is imported statically rather than read at runtime, so demo mode
 * needs no filesystem and no network — but it does mean a rebuild after
 * regenerating it.
 */

import { canonicalAddress } from "./address";
import frozen from "../data/demo-cases.json";
import type { TraceResult } from "./types";

/**
 * AGENTS.md §10 names `NEXT_PUBLIC_DEMO_MODE`, and that is the flag to set.
 *
 * `DEMO_MODE` is accepted as well for one practical reason: Next inlines every
 * `NEXT_PUBLIC_*` value at **build** time, even in server code, so a production
 * build has to be built with the flag already set. The unprefixed name is read
 * from the environment at runtime, which means a built artefact can be switched
 * into demo mode on the night without rebuilding it. In `next dev` either works.
 */
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

interface FrozenCase {
  address: string;
  capturedAt: string;
  trace: TraceResult;
}

function isTraceLike(v: unknown): v is TraceResult {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.caseId === "string" &&
    typeof t.inputAddress === "string" &&
    Array.isArray(t.nodes) &&
    Array.isArray(t.edges) &&
    typeof t.triage === "string"
  );
}

/**
 * Built once at module load. A malformed entry is dropped rather than served:
 * a half-read frozen case would render as a finding, which is the one failure
 * mode this file exists to prevent.
 */
const CASES: Map<string, FrozenCase> = (() => {
  const out = new Map<string, FrozenCase>();
  const rows = Array.isArray(frozen.cases) ? (frozen.cases as unknown[]) : [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.address !== "string" || !isTraceLike(r.trace)) continue;
    out.set(canonicalAddress(r.address), {
      address: canonicalAddress(r.address),
      capturedAt: typeof r.capturedAt === "string" ? r.capturedAt : "",
      trace: r.trace,
    });
  }
  return out;
})();

/**
 * Whether a frozen case answers the run being asked for.
 *
 * A frozen case is one run: one amount, one window, haircut taint, and the
 * chain as it stood when it was captured. Asked for a different amount or
 * window, it would print its own figures under someone else's parameters —
 * the same class of lie as answering for an address it does not belong to. A
 * blank amount or date means "the recorded run", which is what a bare link to
 * a recorded case has always meant. A request for another taint model is by
 * definition a question the file cannot answer, and goes to the chain; so does
 * a request for the chain as of any moment other than the one the case was
 * read at. As of that exact moment it is the recorded run, which is what a
 * link made from a recorded case carries.
 *
 * Both trace routes use this, so the rule cannot hold on one and not the other
 * — which is exactly how it stood before: the permalink checked, and the form
 * and batch triage did not.
 */
export function answersFor(
  frozen: TraceResult,
  run: {
    amount: number | "auto";
    fraudDate: string | "auto";
    model?: string;
    asOf?: string;
  },
): boolean {
  if (run.model && run.model !== "haircut") return false;
  if (run.asOf) {
    const asked = new Date(run.asOf).getTime();
    const read = new Date(frozen.provenance.generatedAt).getTime();
    if (Number.isNaN(asked) || Number.isNaN(read) || Math.abs(asked - read) >= 1000) return false;
  }
  if (run.amount !== "auto" && Math.abs(run.amount - frozen.reportedAmountUsdt) > 0.005) {
    return false;
  }
  if (run.fraudDate !== "auto") {
    const asked = new Date(run.fraudDate).getTime();
    const recorded = new Date(frozen.fraudDate).getTime();
    if (Number.isNaN(asked) || Number.isNaN(recorded) || asked !== recorded) return false;
  }
  return true;
}

/** The exact-match lookup. Null means "we hold nothing for this address". */
export function frozenTrace(address: string): FrozenCase | null {
  // Exact match on the one spelling of the address: case never makes an
  // Ethereum wallet a different wallet, and never makes a TRON one the same.
  return CASES.get(canonicalAddress(address)) ?? null;
}

/** For the operations page and the freeze script's own reporting. */
export function frozenCaseCount(): number {
  return CASES.size;
}

export function frozenAddresses(): string[] {
  return [...CASES.keys()];
}
