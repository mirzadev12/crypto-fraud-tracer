/**
 * Runs this server has already read, kept in memory so that a link pinned to
 * one of them — `?asof=` its own moment, with its own amount, window and
 * model — is answered from the run itself instead of from a second chain read.
 *
 * This is not a shortcut around the evidence. Confirmed transfers never
 * change, so a run pinned to its moment has exactly one answer, and re-deriving
 * it only reads that answer again: half a minute or more per wallet without a
 * key, and a throttled re-read can come back with a wallet unread that the run
 * itself had read. The run is the better copy of itself. Only an exact pinned
 * match is served; a bare link still asks the chain what the wallet looks like
 * now. The answer keeps its own `generatedAt`, so the screen says "as of" the
 * moment it was read, and the audit log records the replay as a replay.
 *
 * In memory and bounded, so a restart forgets it and the links re-derive as
 * before. On globalThis because Next bundles route handlers and
 * instrumentation separately (lib/alert-store.ts says why).
 */
import "server-only";
import type { TraceRun } from "./audit";
import type { TraceRequest } from "./tracer";
import type { TraceResult } from "./types";

const MAX_RUNS = 300;

type Runs = Map<string, TraceResult>;

function runs(): Runs {
  const g = globalThis as typeof globalThis & { __finexRuns?: Runs };
  return (g.__finexRuns ??= new Map());
}

function keyOf(
  chain: string,
  address: string,
  amount: number | "auto",
  since: string | "auto",
  model: string,
  asOf: string,
): string | null {
  const at = new Date(asOf).getTime();
  const from = since === "auto" ? "auto" : new Date(since).getTime();
  if (!Number.isFinite(at) || (from !== "auto" && !Number.isFinite(from))) return null;
  const who = address.startsWith("0x") ? address.toLowerCase() : address;
  return [chain, who, amount === "auto" ? "auto" : amount.toFixed(6), from, model, at].join("|");
}

/** Keep a run this server has just read from the chain. */
export function rememberRun(trace: TraceResult, run: TraceRun): void {
  const key = keyOf(trace.chain, trace.inputAddress, run.amount, run.fraudDate, run.model, trace.provenance.generatedAt);
  if (!key) return;
  const store = runs();
  store.delete(key);
  store.set(key, trace);
  while (store.size > MAX_RUNS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** The run a pinned request asks for, when this server has read exactly it. */
export function replayRun(job: TraceRequest): TraceResult | null {
  if (!job.asOf) return null;
  const chain = job.chain === "polygon" ? "polygon" : job.address.startsWith("0x") ? "ethereum" : "tron";
  const key = keyOf(chain, job.address, job.amount, job.fraudDate, job.model ?? "haircut", job.asOf);
  return key ? (runs().get(key) ?? null) : null;
}
