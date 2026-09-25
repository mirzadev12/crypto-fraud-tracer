/**
 * Alerts when the desk is closed — the rules, kept free of files and network
 * so each decision is tested on its own (`tests/alerts.test.mjs`).
 *
 * The desk's watch (`lib/watch.ts`) asks the chain only while a desk is open,
 * and a CRITICAL wallet that empties at 3 a.m. is then found at 9. With alerts
 * on, the officer's browser hands the same list to the server, the server asks
 * the same one question — has it sent USDT since the case was read? — every
 * five minutes whether or not any desk is open, and wakes the browser with a
 * notification when the answer changes.
 *
 * What does not change is the three answers. A wallet the chain did not answer
 * for is asked again next time; it is never reported as still at rest, and it
 * never produces an alert. And each wallet is reported to each browser once:
 * the notification says that it moved and sends the officer to the desk, where
 * the desk's own check shows where the money went.
 */

import { checkAddress } from "./address";
import { formatDate, formatUsdt, shortAddress } from "./format";
import type { WatchItem } from "./watch";
import { isPushEndpoint, validPushKeys, type PushOutcome, type PushTarget } from "./webpush";

/** One browser that asked to be told. */
export interface AlertSubscription extends PushTarget {
  items: WatchItem[];
  /** Wallet → when this browser was told it moved. Each wallet is told once. */
  notified: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface RunSummary {
  /** When the check finished. */
  at: string;
  /** Distinct wallets asked about. */
  wallets: number;
  /** Of those, how many had sent USDT since they were watched. */
  moved: number;
  /** The chain did not answer: nothing is stated, and they are asked again next time. */
  unchecked: number;
  /** Notifications the push services accepted, and refused. */
  sent: number;
  failed: number;
}

export interface AlertState {
  subscriptions: AlertSubscription[];
  lastRun: RunSummary | null;
}

/** What one read of a wallet's outgoing USDT came back as; null when the chain did not answer. */
export type OutflowRead = {
  transfers: { timestamp: number; value: number }[];
  complete: boolean;
} | null;

/** An alert that has come due for one browser. */
export interface Due {
  endpoint: string;
  item: WatchItem;
  movedUsdt: number;
  transfers: number;
  /** False when more left than one read returns: the figure is a floor. */
  complete: boolean;
}

export const CHECK_EVERY_MINUTES = 5;
/** The same cap as the desk's watch list and `/api/watch`. */
export const MAX_ITEMS = 25;
/** A bound on the file, and on what an unauthenticated route can be made to hold. */
export const MAX_SUBSCRIPTIONS = 200;

export function emptyState(): AlertState {
  return { subscriptions: [], lastRun: null };
}

/** A watch item as the server will hold it, or null. Addresses in their one canonical spelling. */
export function readItem(value: unknown): WatchItem | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (
    typeof r.address !== "string" ||
    typeof r.caseAddress !== "string" ||
    typeof r.caseId !== "string" ||
    typeof r.since !== "string" ||
    typeof r.heldUsdt !== "number"
  ) {
    return null;
  }
  const address = checkAddress(r.address);
  const caseAddress = checkAddress(r.caseAddress);
  const since = Date.parse(r.since);
  const caseId = r.caseId.trim().slice(0, 40);
  if (
    !address.valid ||
    !caseAddress.valid ||
    !caseId ||
    !Number.isFinite(since) ||
    !Number.isFinite(r.heldUsdt) ||
    r.heldUsdt < 0
  ) {
    return null;
  }
  return {
    address: address.address,
    caseAddress: caseAddress.address,
    caseId,
    heldUsdt: r.heldUsdt,
    since: new Date(since).toISOString(),
  };
}

/** The body of `POST /api/alerts`, or the reason it cannot be accepted. */
export function readSync(
  body: unknown,
): { target: PushTarget; items: WatchItem[] } | { error: string } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const sub =
    b?.subscription && typeof b.subscription === "object"
      ? (b.subscription as Record<string, unknown>)
      : null;
  const keys = sub?.keys && typeof sub.keys === "object" ? (sub.keys as Record<string, unknown>) : null;
  if (
    !b ||
    !sub ||
    typeof sub.endpoint !== "string" ||
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string" ||
    !Array.isArray(b.items)
  ) {
    return { error: "Expected { subscription: { endpoint, keys: { p256dh, auth } }, items: [...] }." };
  }
  if (!isPushEndpoint(sub.endpoint)) {
    return { error: "That endpoint is not a browser push service this server sends to." };
  }
  const target = { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
  if (!validPushKeys(target.keys)) return { error: "The subscription's keys are not valid." };
  if (b.items.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} wallets.` };

  const items: WatchItem[] = [];
  for (const raw of b.items) {
    const item = readItem(raw);
    if (!item) {
      return { error: "Each wallet needs a valid address, caseAddress, caseId, heldUsdt and since." };
    }
    if (!items.some((i) => i.address === item.address)) items.push(item);
  }
  return { target, items };
}

/**
 * Take a browser's list. The list replaces the one held: the browser owns it,
 * and sends the whole of it every time it changes. A wallet taken off the watch
 * forgets that it was reported, so putting it back watches it afresh.
 */
export function upsert(
  state: AlertState,
  target: PushTarget,
  items: WatchItem[],
  now: string,
): { ok: true; created: boolean } | { ok: false; error: string } {
  const held = state.subscriptions.find((s) => s.endpoint === target.endpoint);
  if (held) {
    held.keys = target.keys;
    held.items = items;
    held.notified = Object.fromEntries(
      Object.entries(held.notified).filter(([address]) => items.some((i) => i.address === address)),
    );
    held.updatedAt = now;
    return { ok: true, created: false };
  }
  if (state.subscriptions.length >= MAX_SUBSCRIPTIONS) {
    return { ok: false, error: "This server is already watching for as many browsers as it holds." };
  }
  state.subscriptions.push({ ...target, items, notified: {}, createdAt: now, updatedAt: now });
  return { ok: true, created: true };
}

export function removeSubscription(state: AlertState, endpoint: string): boolean {
  const before = state.subscriptions.length;
  state.subscriptions = state.subscriptions.filter((s) => s.endpoint !== endpoint);
  return state.subscriptions.length < before;
}

/**
 * Each wallet some browser still needs news of, asked once, from the earliest
 * moment any of them watches it from. A wallet every watcher has already been
 * told about is not asked again.
 */
export function pendingChecks(state: AlertState): Map<string, number> {
  const out = new Map<string, number>();
  for (const sub of state.subscriptions) {
    for (const item of sub.items) {
      if (sub.notified[item.address]) continue;
      const since = Date.parse(item.since);
      const earliest = out.get(item.address);
      if (earliest === undefined || since < earliest) out.set(item.address, since);
    }
  }
  return out;
}

/**
 * Who is owed an alert after a round of reads. Only a read that came back and
 * shows USDT leaving after that browser's own moment counts; a wallet the chain
 * did not answer for owes nobody anything, however it looked last time.
 */
export function alertsDue(state: AlertState, reads: Map<string, OutflowRead>): Due[] {
  const due: Due[] = [];
  for (const sub of state.subscriptions) {
    for (const item of sub.items) {
      if (sub.notified[item.address]) continue;
      const read = reads.get(item.address);
      if (!read) continue;
      const since = Date.parse(item.since);
      const after = read.transfers.filter((t) => t.timestamp > since);
      if (!after.length) continue;
      due.push({
        endpoint: sub.endpoint,
        item,
        movedUsdt: after.reduce((sum, t) => sum + t.value, 0),
        transfers: after.length,
        complete: read.complete,
      });
    }
  }
  return due;
}

/**
 * The notification itself: short enough for a lock screen, and nothing a
 * reader could take for more than it is. It says the wallet moved and when the
 * case was read — never whose money it was — and sends the officer to the desk.
 */
export function alertMessage(due: Due): { title: string; body: string; url: string; tag: string } {
  const amount = `${due.complete ? "" : "at least "}${formatUsdt(due.movedUsdt, { symbol: false })} USDT`;
  return {
    title: `Funds moved · ${due.item.caseId}`,
    body:
      `${shortAddress(due.item.address)} has sent ${amount} since the case was read on ` +
      `${formatDate(due.item.since)}. Open the desk to see where it went.`,
    url: "/dashboard",
    // One notification per wallet: a second alert about it replaces the first.
    tag: `finex-watch-${due.item.address}`,
  };
}

/**
 * Write a round's outcome back. A delivered alert marks its wallet told; a
 * refused one is tried again next round; a subscription the push service says
 * is gone is dropped (its browser subscribes again when the desk next opens).
 * Anything withdrawn while the round ran is left withdrawn.
 */
export function recordRun(
  state: AlertState,
  sent: { endpoint: string; address: string; outcome: PushOutcome }[],
  summary: RunSummary,
): void {
  for (const { endpoint, address, outcome } of sent) {
    const sub = state.subscriptions.find((s) => s.endpoint === endpoint);
    if (!sub) continue;
    if (outcome.gone) {
      removeSubscription(state, endpoint);
      continue;
    }
    if (outcome.ok && sub.items.some((i) => i.address === address)) {
      sub.notified[address] = summary.at;
    }
  }
  state.lastRun = summary;
}

/**
 * The file as read back, trusting nothing in it: every subscription is
 * re-checked the way the route checks a new one, and anything that fails is
 * dropped rather than allowed to break every later round.
 */
export function readState(value: unknown): AlertState {
  const state = emptyState();
  if (!value || typeof value !== "object") return state;
  const r = value as Record<string, unknown>;
  if (Array.isArray(r.subscriptions)) {
    for (const raw of r.subscriptions) {
      const sync = readSync(raw && typeof raw === "object" ? { subscription: raw, items: (raw as { items?: unknown }).items } : null);
      if ("error" in sync) continue;
      const s = raw as Record<string, unknown>;
      const notified: Record<string, string> = {};
      if (s.notified && typeof s.notified === "object") {
        for (const [address, at] of Object.entries(s.notified as Record<string, unknown>)) {
          if (typeof at === "string" && sync.items.some((i) => i.address === address)) notified[address] = at;
        }
      }
      const stamp = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : new Date(0).toISOString());
      state.subscriptions.push({
        ...sync.target,
        items: sync.items,
        notified,
        createdAt: stamp(s.createdAt),
        updatedAt: stamp(s.updatedAt),
      });
    }
  }
  const run = r.lastRun as Record<string, unknown> | null | undefined;
  if (
    run &&
    typeof run === "object" &&
    typeof run.at === "string" &&
    ["wallets", "moved", "unchecked", "sent", "failed"].every((k) => typeof run[k] === "number")
  ) {
    state.lastRun = {
      at: run.at,
      wallets: run.wallets as number,
      moved: run.moved as number,
      unchecked: run.unchecked as number,
      sent: run.sent as number,
      failed: run.failed as number,
    };
  }
  return state;
}
