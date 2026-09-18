/**
 * The six behavioural rules. AGENTS.md §9.
 *
 * Rules, not a model. Every flag has to be defensible line by line in front of a
 * court, which is why there is no scoring function here and nothing is learned
 * from data — each rule is a threshold someone chose, and the `reason` string
 * says what was observed and what it means.
 *
 * Those strings are rendered verbatim by the interface and read aloud by an
 * investigator. Write them as evidence, not as UI copy: state the number, then
 * state the inference, and never overstate the inference.
 */

import { lookup } from "./labels";
import type { RiskFlag, TraceEdge, TraceNode } from "./types";

/** Under ten minutes is not a person deciding; it is a script. */
const SHORT_DWELL_SECONDS = 600;
/** More than five ways out of one wallet in a single hop. */
const FANOUT_LIMIT = 5;
/** A peel chain needs at least this many small withdrawals to be a pattern. */
const PEEL_MIN_LEGS = 3;
/** A peel leg is small relative to the largest transfer out of that wallet. */
const PEEL_RATIO = 0.25;
/** An address created inside this window before the fraud is suspicious. */
const NEW_ADDRESS_DAYS = 30;

const DAY_MS = 86_400_000;

function minutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? "1 minute" : `${m} minutes`;
}

function amount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** A number is "round" when it is a whole thousand — structuring leaves marks. */
function isRound(value: number): boolean {
  return value >= 1000 && Number.isInteger(value) && value % 1000 === 0;
}

/**
 * What the tracer saw before its own limits were applied.
 *
 * Three of these rules were dead for a subtle reason: they were reading the
 * trace, and the trace is already pruned. The tracer follows the five largest
 * outflows per wallet, so counting edges could never exceed five and a fan-out
 * rule that triggers above five could never fire at all. Worse for peel
 * detection — a peel *is* a series of small withdrawals, and "five largest by
 * value" discards exactly those. Both rules were looking for evidence in the
 * one place it had been removed from.
 *
 * So the tracer now hands over what it actually read per wallet, uncapped, and
 * the rules score that. The trace stays pruned; the reasoning does not.
 */
export interface Observed {
  /** Every outflow after the money arrived, before the top-five cut. */
  outValues: number[];
  /**
   * How many distinct wallets those outflows went to. Fan-out is a claim about
   * wallets, not transfers: fifty payments to one address is not a split.
   */
  recipients: number;
  /** False when we hold only the newest part of the wallet's history. */
  historyComplete: boolean;
}

export function scoreRisk(
  nodes: TraceNode[],
  edges: TraceEdge[],
  fraudDate: string,
  options: {
    observed?: Map<string, Observed>;
    /**
     * Whether a fraud date was actually reported. When it was not, the window
     * is derived from the subject's own first transfer, and "N days before the
     * reported fraud" is a sentence about a date nobody reported.
     */
    fraudDateReported?: boolean;
  } = {},
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const fraudAt = new Date(fraudDate).getTime();
  const observed = options.observed ?? new Map<string, Observed>();

  /* 1 — SHORT_DWELL. Reported once, on the fastest hop observed. */
  const fastest = edges
    .filter((e) => e.dwellSeconds !== null && e.dwellSeconds < SHORT_DWELL_SECONDS)
    .sort((a, b) => (a.dwellSeconds ?? 0) - (b.dwellSeconds ?? 0))[0];
  if (fastest && fastest.dwellSeconds !== null) {
    flags.push({
      code: "SHORT_DWELL",
      reason: `Funds forwarded within ${minutes(fastest.dwellSeconds)} of receipt — indicates automated laundering, not manual movement.`,
      atAddress: fastest.from,
    });
  }

  /* 2 — HIGH_FANOUT. The widest split on the path, in distinct wallets.
     Counted from what the wallet actually did, not from the five outflows the
     tracer chose to follow — see the note on `Observed` above. It counts
     *recipients*: the earlier version counted outgoing transfers, so a wallet
     paying one address fifty times read "split across 50 wallets", which is a
     false sentence in a document an officer signs. Without the tracer's own
     record only the transfers in the trace can be counted, and the rule then
     under-reports rather than guess — `outflowCount` is a count of transfers,
     not of wallets, and is no substitute. */
  const recipients = new Map<string, Set<string>>();
  for (const e of edges) {
    const set = recipients.get(e.from) ?? new Set<string>();
    set.add(e.to);
    recipients.set(e.from, set);
  }
  const fanout = new Map<string, number>();
  for (const [address, set] of recipients) fanout.set(address, set.size);
  for (const [address, seen] of observed) {
    if (seen.recipients > (fanout.get(address) ?? 0)) fanout.set(address, seen.recipients);
  }
  const widest = [...fanout.entries()].sort((a, b) => b[1] - a[1])[0];
  if (widest && widest[1] > FANOUT_LIMIT) {
    flags.push({
      code: "HIGH_FANOUT",
      reason: `Funds split across ${widest[1]} wallets in a single hop.`,
      atAddress: widest[0],
    });
  }

  // Every wallet that sent anything, for the peel rule below.
  const senders = new Set<string>([...recipients.keys()]);
  for (const [address, seen] of observed) if (seen.outValues.length) senders.add(address);

  /* 3 — PEEL_CHAIN. Repeated small withdrawals while the bulk moves on.
     Scored against every outflow the wallet made, because the small legs that
     constitute a peel are the first thing "top five by value" throws away. */
  for (const address of senders) {
    const values =
      observed.get(address)?.outValues ??
      edges.filter((e) => e.from === address).map((e) => e.valueUsdt);
    if (values.length < PEEL_MIN_LEGS + 1) continue;
    const largest = Math.max(...values);
    if (!(largest > 0)) continue;
    const legs = values.filter((v) => v <= largest * PEEL_RATIO);
    if (legs.length >= PEEL_MIN_LEGS) {
      flags.push({
        code: "PEEL_CHAIN",
        reason: `Peel-chain pattern: ${legs.length} small withdrawals against a largest transfer of ${amount(largest)} USDT — the bulk moves on while fractions are shaved off.`,
        atAddress: address,
      });
      break;
    }
  }

  /* 4 — ROUND_AMOUNTS. Structuring, not commerce. */
  const round = edges.filter((e) => isRound(e.valueUsdt));
  if (round.length > 0) {
    const biggest = round.sort((a, b) => b.valueUsdt - a.valueUsdt)[0];
    flags.push({
      code: "ROUND_AMOUNTS",
      reason:
        round.length === 1
          ? `Round-figure transfer of ${amount(biggest.valueUsdt)} USDT suggests structured layering rather than ordinary payment activity.`
          : `${round.length} round-figure transfers, the largest ${amount(biggest.valueUsdt)} USDT, suggest structured layering rather than ordinary payment activity.`,
      atAddress: biggest.from,
    });
  }

  /* 5 — NEW_ADDRESS. A wallet opened for the job.
     Two guards, both about not overstating. The rule is silent when no fraud
     date was reported, because the window is then derived from the subject's
     own first transfer and "before the reported fraud" would name a date
     nobody reported. And a wallet whose history we truncated is skipped: its
     `firstSeen` is the oldest transfer we read, not the day it opened, and
     reading one as the other would call a years-old address freshly created. */
  if (Number.isFinite(fraudAt) && options.fraudDateReported !== false) {
    const fresh = nodes
      .filter((n) => n.depth > 0 && n.firstSeen)
      .filter((n) => observed.get(n.address)?.historyComplete !== false)
      .map((n) => ({ node: n, age: (fraudAt - new Date(n.firstSeen!).getTime()) / DAY_MS }))
      .filter((x) => Number.isFinite(x.age) && x.age >= 0 && x.age < NEW_ADDRESS_DAYS)
      .sort((a, b) => a.age - b.age)[0];
    if (fresh) {
      const days = Math.max(1, Math.round(fresh.age));
      flags.push({
        code: "NEW_ADDRESS",
        reason: `Receiving address was created ${days === 1 ? "1 day" : `${days} days`} before the reported fraud.`,
        atAddress: fresh.node.address,
      });
    }
  }

  /* 6 — SANCTIONED_CONTACT. The path touched something listed. */
  for (const n of nodes) {
    const label = n.label ?? lookup(n.address);
    if (!label) continue;
    if (label.kind === "sanctioned") {
      flags.push({
        code: "SANCTIONED_CONTACT",
        reason: `Path intersects an address listed under sanctions${label.entity ? ` (${label.entity})` : ""} — deterministic tracing stops here and the case is documented.`,
        atAddress: n.address,
      });
      break;
    }
    if (label.kind === "mixer") {
      flags.push({
        code: "SANCTIONED_CONTACT",
        reason:
          "Path enters a known mixing service — deterministic tracing is not possible beyond this point.",
        atAddress: n.address,
      });
      break;
    }
  }

  return flags;
}
