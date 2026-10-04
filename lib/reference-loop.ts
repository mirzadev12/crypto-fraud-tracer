/**
 * The reference re-read: every real wallet in the recorded case file, traced
 * again live — on boot and every six hours — and logged like any other trace.
 *
 * Why it exists: the register used to be a committed file, so every visitor saw
 * the same rows with the same figures, and nothing on screen showed the chain
 * being read. The recorded cases are real wallets; re-reading them now shows
 * what each looks like today (a wallet that was at rest in September may have
 * moved since, and the register then says so), and every answer lands in the
 * hash-chained audit log, which the register is built from.
 *
 * Sequential on purpose, with a gap between wallets: the chain clients pace
 * themselves, and the officers' own traces share that budget. Never runs in
 * demo mode, which promises no network. `FINEX_REFERENCE=off` disables it.
 * The state lives on globalThis because Next bundles instrumentation and the
 * route handlers separately (the same reason as lib/alert-loop.ts).
 */
import "server-only";
import { traceDraft, type TraceRun } from "./audit";
import { appendAudit } from "./audit-store";
import { rememberRun } from "./run-cache";
import { DEMO_MODE, frozenTraces } from "./demo";
import { SYSTEM_ACTOR } from "./identity";
import { runTrace } from "./tracer";

const FIRST_DELAY_MS = 45_000;
const PERIOD_MS = 6 * 60 * 60 * 1000;
const GAP_MS = 10_000;

export interface ReferenceProgress {
  running: boolean;
  /** Wallets finished in the current (or last) pass. */
  done: number;
  total: number;
  /** Wallets whose re-read threw; their previous row stays. */
  failed: number;
  lastPassAt: string | null;
  enabled: boolean;
}

interface Loop {
  started: boolean;
  progress: ReferenceProgress;
}

const g = globalThis as typeof globalThis & { __finexReference?: Loop };

function loop(): Loop {
  g.__finexReference ??= {
    started: false,
    progress: { running: false, done: 0, total: 0, failed: 0, lastPassAt: null, enabled: false },
  };
  return g.__finexReference;
}

function enabled(): boolean {
  return !DEMO_MODE && process.env.FINEX_REFERENCE !== "off";
}

/**
 * The wallets re-read: every recorded case, on the chain it was recorded on,
 * cheapest first — ordered by how many chain responses each recorded trace
 * needed — so the first rows land in seconds and the wallet with the longest
 * history does not hold the rest of the register back.
 */
export function referenceWallets(): { address: string; chain: "tron" | "ethereum" | "polygon" }[] {
  return frozenTraces()
    .slice()
    .sort((a, b) => a.provenance.apiCalls - b.provenance.apiCalls)
    .map((t) => ({ address: t.inputAddress, chain: t.chain }));
}

export function referenceProgress(): ReferenceProgress {
  return { ...loop().progress, enabled: enabled() };
}

export function startReferenceLoop(): void {
  const l = loop();
  if (l.started || !enabled()) return;
  l.started = true;
  l.progress.total = referenceWallets().length;
  const schedule = (delay: number) => {
    const timer = setTimeout(async () => {
      try {
        await runReferencePass();
      } finally {
        schedule(PERIOD_MS);
      }
    }, delay);
    timer.unref?.();
  };
  schedule(FIRST_DELAY_MS);
}

export async function runReferencePass(): Promise<ReferenceProgress> {
  const l = loop();
  if (l.progress.running) return referenceProgress();
  const wallets = referenceWallets();
  l.progress = { ...l.progress, running: true, done: 0, failed: 0, total: wallets.length };
  // Automatic amount and window, as a bare permalink would: the question is
  // "what does this wallet look like now", not a replay of the recorded run.
  const run: TraceRun = { amount: "auto", fraudDate: "auto", model: "haircut" };
  for (const w of wallets) {
    try {
      const trace = await runTrace({
        address: w.address,
        amount: "auto",
        fraudDate: "auto",
        ...(w.chain === "polygon" ? { chain: "polygon" as const } : {}),
      });
      rememberRun(trace, run);
      await appendAudit(traceDraft(SYSTEM_ACTOR, trace, run, "live"));
    } catch (err) {
      l.progress.failed++;
      console.warn(`[reference] ${w.address} could not be re-read:`, err instanceof Error ? err.message : err);
    }
    l.progress.done++;
    await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }
  l.progress = { ...l.progress, running: false, lastPassAt: new Date().toISOString() };
  return referenceProgress();
}
