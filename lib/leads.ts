/**
 * What the investigator should do next.
 *
 * The product is described in three layers — trace, understand, act — and until
 * now the third one was a single sentence. `triageReason` says what kind of case
 * this is; it does not say which of the eleven wallets on the canvas is worth
 * the next hour, and that is the question an officer with a queue actually has.
 *
 * So: ranked leads, each one a finding this pipeline already computed, phrased
 * as something to do, with the figures it was derived from attached.
 *
 * Three rules, and they are the whole design:
 *
 *  1. **Nothing new is measured here.** Every lead is arithmetic over the
 *     `TraceResult` the tracer already produced — taint, dwell, outflow counts,
 *     labels, risk flags. If a figure appears in a lead, the same figure appears
 *     in a table elsewhere on the screen. A "lead" that needed its own model
 *     would be a different claim with no evidence behind it.
 *  2. **Ranked by what can still be done, not by what is most alarming.** A
 *     sanctioned-entity hit is the most serious thing on a COLD case and also
 *     the least actionable, so it does not outrank money still sitting in a
 *     wallet. The order answers "where does the next hour go".
 *  3. **One lead per wallet.** The canvases mark leads by number, and a wallet
 *     wearing two numbers is a worse canvas. Where a wallet earns several, the
 *     most actionable wins and the rest are dropped.
 *
 * Deliberately *not* here: anything phrased as a conclusion about a person, and
 * anything an LLM wrote. These are computed, cited, and stated as leads.
 */

import { betweenness } from "./centrality";
import { formatDwell, formatPercent, formatUsdt } from "./format";
import type { TraceResult } from "./types";

export type LeadCode =
  | "NEVER_MOVED"
  | "AT_REST"
  | "EXIT_ACCOUNT"
  | "EXIT_OMNIBUS"
  | "CHOKEPOINT"
  | "SANCTIONS_STOP"
  | "UNRESOLVED_TAIL"
  | "RAPID_FORWARD";

export interface Lead {
  /** 1-based, assigned after ranking — this is the number the canvases draw. */
  rank: number;
  code: LeadCode;
  /** Imperative, four or five words. */
  title: string;
  /** What was observed, in one sentence. */
  finding: string;
  /** What to do about it. */
  action: string;
  /** The wallet the lead points at, and what gets marked on the canvas. */
  address: string;
  /** Figures read straight off the trace, for the row under the finding. */
  evidence: string[];
  tone: "critical" | "suspicious" | "neutral";
}

/** Lower sorts first. Actionability, not severity — see rule 2 above. */
const PRIORITY: Record<LeadCode, number> = {
  NEVER_MOVED: -1,
  AT_REST: 0,
  EXIT_ACCOUNT: 1,
  EXIT_OMNIBUS: 2,
  CHOKEPOINT: 3,
  UNRESOLVED_TAIL: 4,
  RAPID_FORWARD: 5,
  SANCTIONS_STOP: 6,
};

const MAX_LEADS = 5;
/** A wallet has to carry a real share of the money to be worth naming. */
const CHOKEPOINT_MIN_SHARE = 0.2;
const FAST_SECONDS = 600;

/**
 * Two figures the trace already contains and never stated.
 *
 * **Concentration** — the largest share of the reported amount that passed
 * through any single wallet. A trail that fans into twenty wallets holding 5%
 * each is a different object from one where 78% went through one address, and
 * the second is an investigation with an obvious next step.
 *
 * **The unresolved tail** — taint still moving at the last hop the tracer was
 * willing to follow. The five limits in `tracer.ts` are load-bearing and
 * documented, but when a trail runs past them the result simply goes quiet, and
 * silence reads as "nothing there" rather than "we stopped looking". Stating
 * the number turns a hidden limitation into a declared one.
 *
 * Derived, not stored: `lib/types.ts` is frozen, so neither of these becomes a
 * field on `TraceResult`. They are computed from `nodes` on demand, which also
 * means a recorded case captured before this existed reports them correctly.
 */
export interface FlowMetrics {
  /** Largest share of the reported amount through one wallet, 0..1. */
  concentration: number;
  concentrationAddress: string | null;
  /** Taint still in motion at the search horizon. */
  unresolvedUsdt: number;
  unresolvedShare: number;
  unresolvedWallets: number;
  /** The hop the trace stopped at. */
  maxDepth: number;
}

export function flowMetrics(trace: TraceResult): FlowMetrics {
  const reached = trace.nodes.filter((n) => n.depth > 0);
  const maxDepth = trace.nodes.reduce((max, n) => Math.max(max, n.depth), 0);

  const heaviest = [...reached].sort((a, b) => b.taintFraction - a.taintFraction)[0];

  /*
   * A wallet counts as unresolved only if it was still *sending* when we
   * stopped. One that received and held is not an unfollowed trail — it is the
   * "funds at rest" finding, and counting it here would double-report the same
   * money as both resting and escaping. Attributed wallets are excluded for the
   * same reason: the trace stopped there deliberately, that is the answer.
   */
  const tail = reached.filter(
    (n) => maxDepth > 0 && n.depth >= maxDepth && !n.label && n.outflowCount > 0,
  );

  return {
    concentration: heaviest?.taintFraction ?? 0,
    concentrationAddress: heaviest?.address ?? null,
    unresolvedUsdt: tail.reduce((sum, n) => sum + n.taintedValueUsdt, 0),
    unresolvedShare: tail.reduce((sum, n) => sum + n.taintFraction, 0),
    unresolvedWallets: tail.length,
    maxDepth,
  };
}

export function deriveLeads(trace: TraceResult): Lead[] {
  const draft: Array<Omit<Lead, "rank">> = [];
  const reached = trace.nodes.filter((n) => n.depth > 0);
  const maxDepth = trace.nodes.reduce((max, n) => Math.max(max, n.depth), 0);

  /* 0 — The money never left the reported wallet.
     Elsewhere in this codebase the subject address is deliberately never the
     *finding* of its own case — otherwise tracing a known deposit address
     reports that the money "reached" where it started. A lead is a different
     object: when nothing has left the reported wallet, the most actionable
     sentence in the whole case is that the funds are still at the address the
     victim gave us, and the one case where that is true is the one where speed
     matters most. Excluding it left the CRITICAL case with nothing under
     "what next", which is precisely backwards. */
  // Only on a CRITICAL case. A wallet that neither received nor sent anything
  // inside the window also has no outflows and no edges, and telling an officer
  // its funds "have not moved" would send them after money it never held.
  const subject = trace.nodes.find((n) => n.depth === 0);
  if (
    subject &&
    trace.triage === "HOT" &&
    subject.outflowCount === 0 &&
    trace.edges.length === 0
  ) {
    draft.push({
      code: "NEVER_MOVED",
      title: "The funds have not moved",
      finding: `No transfer has been observed leaving the reported wallet since the window opened, and the case is measured against ${formatUsdt(trace.reportedAmountUsdt)}.`,
      action:
        "Nothing has been laundered yet, so this is the case on the list with the shortest window and the best odds. Confirm the balance on a public explorer and escalate before anything moves.",
      address: subject.address,
      evidence: [
        "no outgoing transfers observed",
        "no intermediary wallets to follow",
        "reported wallet only",
      ],
      tone: "critical",
    });
  }

  /* 1 — Money that arrived somewhere and never left.
     Attributed wallets are excluded, and not as a nicety: the tracer stops
     fetching at an exchange, so an exit's `outflowCount` is zero because we
     never looked, not because the funds are sitting there. Reading that as
     "at rest" would point an officer at a wallet on the strength of a read we
     did not perform. A wallet that returned no history at all is excluded for
     the same reason: `firstSeen` is null only when the chain did not answer
     for it, and zero outflows from an unread wallet is not a finding. */
  const atRest = reached
    .filter(
      (n) =>
        !n.label && n.outflowCount === 0 && n.taintedValueUsdt > 0 && n.firstSeen !== null,
    )
    .sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
  if (atRest) {
    draft.push({
      code: "AT_REST",
      title: "Money is still sitting here",
      finding: `${formatUsdt(atRest.taintedValueUsdt)} reached this wallet and no outgoing transfer has been observed from it since.`,
      action:
        "This is the only wallet on the path where funds may still be reachable. Confirm the current balance on a public explorer before anything else in this case.",
      address: atRest.address,
      evidence: [
        `${formatPercent(atRest.taintFraction)} of the reported amount`,
        `hop ${atRest.depth}`,
        "no outgoing transfers observed",
      ],
      tone: "critical",
    });
  }

  /* 2 — A named exit. The deposit address is the account an exchange can act
     on; an omnibus hot wallet is not, and the two get different sentences
     because they support different requests. */
  const terminal = trace.terminal;
  const terminalNode = terminal
    ? trace.nodes.find((n) => n.address === terminal.address)
    : undefined;
  if (terminal && terminalNode && terminal.label.kind === "exchange_deposit") {
    draft.push({
      code: "EXIT_ACCOUNT",
      title: "Send the freeze request here",
      finding: `${formatUsdt(terminalNode.taintedValueUsdt)} reached an address attributed to a single customer deposit account at ${terminal.label.entity}.`,
      action: `A restraint request naming this address can be actioned by ${terminal.label.entity}, because it identifies one account rather than the exchange as a whole. Attribution is ${terminal.label.source === "heuristic" ? "heuristic — state the confidence in the request" : "from a public explorer tag"}.`,
      address: terminal.address,
      evidence: [
        `${formatPercent(terminalNode.taintFraction)} of the reported amount`,
        `attribution confidence ${formatPercent(terminal.label.confidence)}`,
        terminal.label.source.replace(/_/g, " "),
      ],
      tone: "suspicious",
    });
  } else if (terminal && terminalNode && terminal.label.kind === "exchange_hot") {
    draft.push({
      code: "EXIT_OMNIBUS",
      title: "Ask the exchange to name the account",
      finding: `${formatUsdt(terminalNode.taintedValueUsdt)} reached ${terminal.label.entity}'s own hot wallet, which the whole exchange transacts through.`,
      action: `The receiving account cannot be identified from the chain here. ${terminal.label.entity} can identify it from the deposit transaction — request it by transaction hash and timestamp rather than by address.`,
      address: terminal.address,
      evidence: [
        `${formatPercent(terminalNode.taintFraction)} of the reported amount`,
        "omnibus wallet — account not on-chain",
      ],
      tone: "neutral",
    });
  }

  /* 3 — The bottleneck.
     Two different properties decide this and they disagree often enough to be
     worth separating: how much of the victim's money a wallet carried, and how
     many of the routes through the case it sits on. A wallet can hold very
     little and still be the address every path has to cross — identify that
     one and the case is covered. Betweenness answers the second question
     properly (see lib/centrality.ts); taint answers the first and is already
     on every node. The lead ranks on position and reports both, so neither
     figure is quietly standing in for the other. */
  const central = betweenness(
    trace.nodes.map((n) => n.address),
    trace.edges,
  );
  const candidates = reached
    .filter((n) => !n.label && n.outflowCount > 0)
    .filter(
      (n) =>
        n.taintFraction >= CHOKEPOINT_MIN_SHARE || (central.get(n.address) ?? 0) > 0,
    );
  const chokepoint = [...candidates].sort(
    (a, b) =>
      (central.get(b.address) ?? 0) - (central.get(a.address) ?? 0) ||
      b.taintFraction - a.taintFraction,
  )[0];
  if (chokepoint) {
    const position = central.get(chokepoint.address) ?? 0;
    // Only claim the bottleneck when the graph actually says so. On a straight
    // line every wallet scores zero, and there the honest lead is the older
    // one: this is simply where most of the money went.
    const isBottleneck = position > 0;
    draft.push({
      code: "CHOKEPOINT",
      title: isBottleneck ? "Every route runs through here" : "Most of the money passed through",
      finding: isBottleneck
        ? `This unattributed wallet lies on more of the routes through this case than any other, and ${formatPercent(chokepoint.taintFraction)} of the reported amount — ${formatUsdt(chokepoint.taintedValueUsdt)} — passed through it.`
        : `${formatPercent(chokepoint.taintFraction)} of the reported amount — ${formatUsdt(chokepoint.taintedValueUsdt)} — passed through this single unattributed wallet before moving on.`,
      action:
        "Nothing in the label tables attributes it, so it is the most useful wallet on the path to identify. Its own funding history is the next thing to read.",
      address: chokepoint.address,
      evidence: [
        ...(isBottleneck
          ? [`betweenness ${position.toFixed(2)} of 1.00 — highest on the path`]
          : []),
        `${chokepoint.outflowCount} outgoing transfer${chokepoint.outflowCount === 1 ? "" : "s"}`,
        `hop ${chokepoint.depth}`,
        "no attribution on file",
      ],
      tone: "suspicious",
    });
  }

  /* 4 — Taint that left the search horizon. The limits are load-bearing and
     documented, but a trail that ran past them is silence, and silence reads
     as "nothing there". State the number instead. */
  // One implementation, shared with the figures on screen — a lead and a stat
  // tile disagreeing about the same number is worse than neither existing.
  const metrics = flowMetrics(trace);
  const tail = reached.filter(
    (n) => maxDepth > 0 && n.depth >= maxDepth && !n.label && n.outflowCount > 0,
  );
  const tailValue = metrics.unresolvedUsdt;
  const tailShare = metrics.unresolvedShare;
  if (tail.length && tailShare >= 0.01) {
    const worst = [...tail].sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
    draft.push({
      code: "UNRESOLVED_TAIL",
      title: "The trail runs past our horizon",
      finding: `${formatUsdt(tailValue)} — ${formatPercent(tailShare)} of the reported amount — was still moving at hop ${maxDepth}, where this trace stops, across ${tail.length} wallet${tail.length === 1 ? "" : "s"}.`,
      action:
        "These wallets were still forwarding funds when the search ended. Re-running the trace from the largest of them continues the trail from where it was cut.",
      address: worst.address,
      evidence: [
        `${tail.length} wallet${tail.length === 1 ? "" : "s"} at the limit`,
        `largest holds ${formatUsdt(worst.taintedValueUsdt, { symbol: false })} USDT`,
      ],
      tone: "neutral",
    });
  }

  /* 5 — The fastest hop observed. A person did not do this. */
  const fastest = trace.edges
    .filter((e) => e.dwellSeconds !== null && e.dwellSeconds < FAST_SECONDS)
    .sort((a, b) => (a.dwellSeconds ?? 0) - (b.dwellSeconds ?? 0))[0];
  if (fastest && fastest.dwellSeconds !== null) {
    draft.push({
      code: "RAPID_FORWARD",
      title: "This hop was automated",
      finding: `Funds were forwarded out of this wallet ${formatDwell(fastest.dwellSeconds)} after arriving.`,
      action:
        "A delay this short is a script, not a person deciding. Wallets that behave this way are usually part of a prepared route rather than an individual's own account.",
      address: fastest.from,
      evidence: [
        `${formatDwell(fastest.dwellSeconds)} between receipt and forwarding`,
        `${formatUsdt(fastest.valueUsdt, { symbol: false })} USDT moved`,
      ],
      tone: "suspicious",
    });
  }

  /* 6 — A listed entity or a mixer. Serious, and the least actionable thing on
     the list, which is exactly why it sorts last rather than first. */
  const blocked = reached.find(
    (n) => n.label?.kind === "sanctioned" || n.label?.kind === "mixer",
  );
  if (blocked?.label) {
    const mixer = blocked.label.kind === "mixer";
    draft.push({
      code: "SANCTIONS_STOP",
      title: mixer ? "Tracing stops at this service" : "Report the sanctions nexus",
      finding: mixer
        ? `${formatUsdt(blocked.taintedValueUsdt)} entered a known mixing service, past which funds cannot be followed deterministically.`
        : `${formatUsdt(blocked.taintedValueUsdt)} reached an address listed under sanctions (${blocked.label.entity}).`,
      action: mixer
        ? "No further on-chain tracing is possible from here, and nobody else's tool can do it either. Record the entry point and the amount, and close the on-chain line of enquiry."
        : "This is a reporting obligation rather than a recovery route — the listed entity is not a counterparty a restraint request can be sent to. Record the listing reference in the case file.",
      address: blocked.address,
      evidence: [
        `${formatPercent(blocked.taintFraction)} of the reported amount`,
        blocked.label.evidence ?? blocked.label.source.replace(/_/g, " "),
      ],
      tone: "critical",
    });
  }

  /* One lead per wallet: the canvases mark them by number, and a wallet wearing
     two numbers is a worse canvas. Most actionable wins. */
  const byAddress = new Map<string, Omit<Lead, "rank">>();
  for (const lead of draft.sort((a, b) => PRIORITY[a.code] - PRIORITY[b.code])) {
    if (!byAddress.has(lead.address)) byAddress.set(lead.address, lead);
  }

  return [...byAddress.values()]
    .sort((a, b) => PRIORITY[a.code] - PRIORITY[b.code])
    .slice(0, MAX_LEADS)
    .map((lead, i) => ({ ...lead, rank: i + 1 }));
}

/** Address → rank, for the canvases that draw the number on the wallet. */
export function leadMarks(leads: Lead[]): Map<string, number> {
  return new Map(leads.map((l) => [l.address, l.rank]));
}
