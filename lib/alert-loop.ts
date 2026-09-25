/**
 * The server's own check: every five minutes, whether or not any desk is open.
 *
 * Started once per server process — from `instrumentation.ts` when the server
 * starts, so a server that has just been deployed or woken resumes on its own,
 * and from the alerts route as well, in case it was not. Each round asks the
 * chain about every wallet some browser is still waiting to hear about, one
 * request each, through the same clients and the same shared pacing a trace
 * uses, so the check can never crowd out an officer's trace. It never runs two
 * rounds at once, and a round with nothing to ask reads nothing.
 *
 * A round asked for while one is running is not dropped: it runs as soon as the
 * current one finishes, so a wallet added mid-round is not left for the next
 * scheduled one.
 *
 * Server-only.
 */

import { checkAddress } from "./address";
import {
  CHECK_EVERY_MINUTES,
  alertMessage,
  alertsDue,
  pendingChecks,
  recordRun,
  type OutflowRead,
  type RunSummary,
} from "./alerts";
import { loadState, mutate, vapidKeys, vapidSubject } from "./alert-store";
import { EthClient } from "./ethclient";
import { TronGrid } from "./trongrid";
import { sendPush, type PushOutcome } from "./webpush";

interface Loop {
  running: boolean;
  again: boolean;
  soon?: ReturnType<typeof setTimeout>;
}

const holder = globalThis as typeof globalThis & { __finexAlertLoop?: Loop };

export function startAlertLoop(): void {
  // A build renders pages; it must not start checking wallets.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (holder.__finexAlertLoop) return;
  holder.__finexAlertLoop = { running: false, again: false };
  const timer = setInterval(() => void runAlertCheck(), CHECK_EVERY_MINUTES * 60_000);
  // Never the reason a process stays alive.
  timer.unref?.();
  // A server that has just started checks within half a minute, not five.
  checkSoon(30_000);
}

/** Run a round shortly — after a browser hands over its list, so its first answer is not five minutes away. */
export function checkSoon(delayMs = 2_000): void {
  const loop = holder.__finexAlertLoop;
  if (!loop) return;
  if (loop.soon) clearTimeout(loop.soon);
  loop.soon = setTimeout(() => {
    loop.soon = undefined;
    void runAlertCheck();
  }, delayMs);
  loop.soon.unref?.();
}

export async function runAlertCheck(): Promise<RunSummary | null> {
  const loop = holder.__finexAlertLoop;
  if (!loop) return null;
  if (loop.running) {
    loop.again = true;
    return null;
  }
  loop.running = true;
  try {
    return await round();
  } catch (err) {
    console.error("[alerts] check failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    loop.running = false;
    if (loop.again) {
      loop.again = false;
      checkSoon();
    }
  }
}

async function round(): Promise<RunSummary | null> {
  const state = await loadState();
  // Nobody has asked to be told anything: read nothing, write nothing.
  if (!state.subscriptions.length) return null;

  const checks = pendingChecks(state);
  const tron = new TronGrid();
  const eth = new EthClient();
  const reads = new Map<string, OutflowRead>();
  let moved = 0;
  let unchecked = 0;
  for (const [address, sinceMs] of checks) {
    const check = checkAddress(address);
    const read = check.valid
      ? await (check.chain === "ethereum" ? eth : tron).outflowsSince(check.address, sinceMs)
      : null;
    if (!read) {
      unchecked += 1;
      reads.set(address, null);
      continue;
    }
    if (read.transfers.length) moved += 1;
    reads.set(address, {
      transfers: read.transfers.map((t) => ({ timestamp: t.timestamp, value: t.value })),
      complete: read.complete,
    });
  }

  const due = alertsDue(state, reads);
  const sent: { endpoint: string; address: string; outcome: PushOutcome }[] = [];
  if (due.length) {
    const keys = await vapidKeys();
    const subject = vapidSubject();
    for (const d of due) {
      const target = state.subscriptions.find((s) => s.endpoint === d.endpoint);
      if (!target) continue;
      const outcome = await sendPush(target, alertMessage(d), keys, subject);
      if (!outcome.ok) {
        console.warn(
          `[alerts] push to ${new URL(d.endpoint).host} refused: ${outcome.status} ${outcome.detail ?? ""}`.trim(),
        );
      }
      sent.push({ endpoint: d.endpoint, address: d.item.address, outcome });
    }
  }

  const summary: RunSummary = {
    at: new Date().toISOString(),
    wallets: checks.size,
    moved,
    unchecked,
    sent: sent.filter((s) => s.outcome.ok).length,
    failed: sent.filter((s) => !s.outcome.ok).length,
  };
  await mutate((fresh) => recordRun(fresh, sent, summary));
  return summary;
}
