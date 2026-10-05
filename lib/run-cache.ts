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

/*
 * Two short-lived helpers for a bare request — no `asof`, "what does this
 * wallet look like now". Both answer with a run this server has just read, so
 * they never state an older chain than the run's own `generatedAt` says.
 *
 *  - Recent: the same bare request within two minutes is answered with the run
 *    just read — or, for a recorded wallet, with the server's own scheduled
 *    re-read of it (lib/reference-loop.ts, every six hours), so a batch of the
 *    recorded wallets does not re-read fourteen histories the server read
 *    hours ago. Either way the loader shows it as a replay with its read time. Opening a case, then its packet, then its request would
 *    otherwise read the chain three times in a row for the same answer.
 *  - Shared: identical requests arriving while a read is running wait for that
 *    read instead of starting their own, which on a keyless endpoint would
 *    only queue behind it and slow every one of them.
 */
const RECENT_MS = 120_000;
type Recent = Map<string, { until: number; trace: TraceResult }>;
type Inflight = Map<string, Promise<TraceResult>>;

function recent(): Recent {
  const g = globalThis as typeof globalThis & { __finexRecent?: Recent };
  return (g.__finexRecent ??= new Map());
}
function inflight(): Inflight {
  const g = globalThis as typeof globalThis & { __finexInflight?: Inflight };
  return (g.__finexInflight ??= new Map());
}
const jobKey = (job: TraceRequest) =>
  JSON.stringify([
    job.chain ?? "",
    job.address.startsWith("0x") ? job.address.toLowerCase() : job.address,
    job.amount,
    job.fraudDate,
    job.model ?? "haircut",
    job.asOf ?? "",
  ]);

/** Run a trace, or wait for the identical one already running. */
export function sharedRun(job: TraceRequest, read: () => Promise<TraceResult>): Promise<TraceResult> {
  const key = jobKey(job);
  const running = inflight().get(key);
  if (running) return running;
  const p = read().finally(() => inflight().delete(key));
  inflight().set(key, p);
  return p;
}

/** Keep a run this server has just read from the chain. */
export function rememberRun(trace: TraceResult, run: TraceRun, job?: TraceRequest, keepMs = RECENT_MS): void {
  if (job && !job.asOf) {
    const store = recent();
    const now = Date.now();
    // The newest read is kept, for as long as either read was to be kept.
    const prior = store.get(jobKey(job));
    if (!prior || prior.trace.provenance.generatedAt <= trace.provenance.generatedAt) {
      store.set(jobKey(job), { until: Math.max(prior?.until ?? 0, now + keepMs), trace });
    }
    for (const [k, v] of store) if (v.until < now) store.delete(k);
  }
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
  if (!job.asOf) {
    const hit = recent().get(jobKey(job));
    return hit && Date.now() <= hit.until ? hit.trace : null;
  }
  const chain = job.chain === "polygon" ? "polygon" : job.address.startsWith("0x") ? "ethereum" : "tron";
  const key = keyOf(chain, job.address, job.amount, job.fraudDate, job.model ?? "haircut", job.asOf);
  return key ? (runs().get(key) ?? null) : null;
}
