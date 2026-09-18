/**
 * The watch on money that has not moved yet.
 *
 * A CRITICAL case is the most valuable thing on the desk and the most
 * perishable: the funds are sitting in a wallet with no outgoing transfers, and
 * the finding is true only until they move. The trace states it as at the
 * moment the chain was read — "funds at rest" is a claim with a timestamp, and
 * nobody was told when that timestamp stopped being true.
 *
 * So every CRITICAL case puts the wallet holding the funds on a watch, and the
 * desk re-asks the chain one narrow question about each: has it sent USDT since
 * the case was read? The answer is one of three, never two — moved, still at
 * rest, or **not checked** because the chain did not answer. A wallet we could
 * not read reported as still at rest is the same lie as reporting an unreadable
 * wallet as empty, and it would be told about the wallet an officer is most
 * likely to act on.
 *
 * Pure types and one pure function, so both the browser and the route use them.
 */

import { isIllustrative } from "./api";
import type { TraceResult } from "./types";

export interface WatchItem {
  /** The wallet holding the funds — not necessarily the reported address. */
  address: string;
  /** The complaint it belongs to, so an alert can reopen that case. */
  caseAddress: string;
  caseId: string;
  /** USDT this wallet held when the case was read. */
  heldUsdt: number;
  /** When the chain was read. Movement is checked from this moment on. */
  since: string;
}

export interface WatchMovement {
  txHash: string;
  to: string;
  valueUsdt: number;
  timestamp: string;
  /** How the destination is allowed to be named, already through entityPhrase. */
  toPhrase: string | null;
}

export type WatchResult =
  | { address: string; status: "moved"; movements: WatchMovement[]; complete: boolean }
  | { address: string; status: "still" }
  /** The chain did not answer. Nothing is stated about the wallet. */
  | { address: string; status: "unchecked"; reason: string };

/**
 * What to watch for a finished trace, or null when there is nothing honest to
 * watch.
 *
 * Only a CRITICAL case has money at rest. The wallet chosen is the same one the
 * trace screen names as holding the funds — the at-rest wallet carrying the
 * largest share of the victim's money — so the watch and the finding can never
 * be about two different addresses.
 *
 * The committed illustrative cases are excluded: they were never on TRON, so a
 * chain read about them can only ever say "still at rest", which would be true
 * and meaningless and would look like a working alert.
 *
 * A wallet that returned no history at all is excluded too. It also shows zero
 * outflows, but only because the chain did not answer for it — the finding
 * never names it, and a watch on it would be a watch on a guess.
 */
export function watchTargetFor(trace: TraceResult): WatchItem | null {
  if (trace.triage !== "HOT") return null;
  if (isIllustrative(trace.inputAddress)) return null;
  const resting = [...trace.nodes]
    .filter((n) => n.outflowCount === 0 && n.taintedValueUsdt > 0 && n.firstSeen !== null)
    .sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
  if (!resting) return null;
  return {
    address: resting.address,
    caseAddress: trace.inputAddress,
    caseId: trace.caseId,
    heldUsdt: resting.taintedValueUsdt,
    since: trace.provenance.generatedAt,
  };
}
