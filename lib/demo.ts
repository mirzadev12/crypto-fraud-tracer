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
 * Two rules govern it, and both come from CONTEXT.md §3:
 *
 *  1. **A frozen trace is never served for an address it does not belong to.**
 *     The lookup is by exact address. If demo mode is on and the address is not
 *     in the file, the request goes to the chain like any other — and if the
 *     network is gone, it fails honestly. The moment a demo answers for an
 *     address it does not hold, nothing else on screen can be trusted.
 *  2. **A frozen trace never claims to be live.** The route stamps
 *     `x-finex-provenance: recorded` on it, `lib/api.ts` reads that header, and
 *     the screen shows RECORDED TRACE rather than LIVE TRACE.
 *
 * The file is imported statically rather than read at runtime, so demo mode
 * needs no filesystem and no network — but it does mean a rebuild after
 * regenerating it.
 */

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
    out.set(r.address.trim(), {
      address: r.address.trim(),
      capturedAt: typeof r.capturedAt === "string" ? r.capturedAt : "",
      trace: r.trace,
    });
  }
  return out;
})();

/** The exact-match lookup. Null means "we hold nothing for this address". */
export function frozenTrace(address: string): FrozenCase | null {
  return CASES.get(address.trim()) ?? null;
}

/** For the operations page and the freeze script's own reporting. */
export function frozenCaseCount(): number {
  return CASES.size;
}

export function frozenAddresses(): string[] {
  return [...CASES.keys()];
}
