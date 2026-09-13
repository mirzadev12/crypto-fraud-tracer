/**
 * Forward trace from a victim-reported address. AGENTS.md §9.
 *
 * Five limits, and every one of them exists because without it the trace
 * explodes and the demo dies:
 *
 *   depth <= 3
 *   the five largest outflows per wallet, by value
 *   drop any transfer below 1% of the reported amount
 *   only transfers after the fraud date
 *   stop expanding the moment a wallet is attributable — that is the answer
 *
 * Taint is what makes this evidence rather than a picture. A wallet that
 * received 40% of its parent's outgoing value inherits 40% of the parent's
 * taint, so the result can say "46,208 USDT of the victim's money reached this
 * address" instead of "this address exists".
 */

import { isTerminal, lookup } from "./labels";
import { scoreRisk, type Observed } from "./risk";
import type { TraceProgress } from "./progress";
import { TronGrid, type Trc20Transfer } from "./trongrid";
import type { Label, TraceEdge, TraceNode, TraceResult, TriageLevel } from "./types";

const MAX_DEPTH = 3;
const TOP_OUTFLOWS = 5;
const DUST_FRACTION = 0.01;

export interface TraceRequest {
  address: string;
  /**
   * The reported amount, or "auto" when nobody told us — a permalink carries an
   * address and nothing else. "auto" adopts everything that left the address
   * after the fraud date, so taint figures come out in real USDT instead of as
   * fractions of a placeholder.
   */
  amount: number | "auto";
  /**
   * ISO timestamp, or "auto" when nobody gave one. "auto" opens the window just
   * before the subject wallet's earliest transfer on record, so any wallet with
   * history produces a trail. Defaulting to *today* instead is what made most
   * wallets come back empty: nothing is followed before the fraud date.
   */
  fraudDate: string | "auto";
}

/** Deterministic, human-quotable case reference derived from the address. */
function caseIdFor(address: string, fraudDate: string): string {
  let hash = 0;
  for (const ch of address) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const year = new Date(fraudDate).getUTCFullYear() || new Date().getUTCFullYear();
  return `FX-${year}-${String(hash % 10000).padStart(4, "0")}`;
}

export async function runTrace(
  req: TraceRequest,
  onProgress?: (event: TraceProgress) => void,
): Promise<TraceResult> {
  const root = req.address.trim();
  const emit = (event: TraceProgress) => {
    try {
      onProgress?.(event);
    } catch {
      // A listener must never be able to break a trace.
    }
  };
  // Resolved from the subject wallet's own history when the caller said "auto".
  let fraudAt = req.fraudDate === "auto" ? Number.NaN : new Date(req.fraudDate).getTime();

  // Resolved from the root's own outflows when the caller said "auto".
  let reported = typeof req.amount === "number" ? Math.max(0, req.amount) : 0;

  const grid = new TronGrid();
  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  /** Per wallet, what was read before this tracer's own limits pruned it. */
  const observed = new Map<string, Observed>();

  /** When each wallet took receipt of the victim's money — feeds dwell time. */
  const receivedAt = new Map<string, number>();
  if (!Number.isNaN(fraudAt)) receivedAt.set(root, fraudAt);

  emit({
    type: "start",
    address: root,
    amount: req.amount,
    window: Number.isNaN(fraudAt) ? "auto" : new Date(fraudAt).toISOString(),
  });

  const rootLabel: Label = {
    entity: "Victim-reported address",
    kind: "victim_reported",
    confidence: 1,
    source: "ground_truth",
  };

  let queue: Array<{ address: string; depth: number; taint: number }> = [
    { address: root, depth: 0, taint: 1 },
  ];

  while (queue.length > 0) {
    const next: typeof queue = [];
    emit({ type: "hop", depth: queue[0].depth, wallets: queue.length });

    for (const item of queue) {
      // A wallet reached twice keeps the larger share of the victim's money.
      const existing = nodes.get(item.address);
      if (existing && existing.taintFraction >= item.taint) continue;

      const label = item.address === root ? rootLabel : lookup(item.address);
      const stopHere = item.address !== root && isTerminal(label);
      if (label && item.address !== root) {
        emit({
          type: "label",
          address: item.address,
          depth: item.depth,
          entity: label.entity,
          kind: label.kind,
          source: label.source,
        });
      }

      // An exchange wallet is the answer, not a place to keep looking. Skipping
      // the fetch here is not just an optimisation: Binance-Hot 7 has millions
      // of transfers, and pulling them would spend the whole rate-limit budget
      // enumerating an exchange's own bookkeeping.
      const transfers: Trc20Transfer[] = stopHere
        ? []
        : await grid.transfers(item.address);

      // No fraud date given: open the window just before the subject's earliest
      // transfer on record, so any wallet with history has a trail to follow.
      if (item.address === root && Number.isNaN(fraudAt)) {
        const earliest = transfers.length
          ? Math.min(...transfers.map((t) => t.timestamp))
          : Date.now() - 365 * 86_400_000;
        fraudAt = earliest - 1000;
        receivedAt.set(root, fraudAt);
        emit({ type: "window", since: new Date(fraudAt).toISOString() });
      }
      const windowStart = fraudAt;
      const outAll = transfers.filter(
        (t) => t.from === item.address && t.timestamp > windowStart,
      );
      const firstSeen = transfers.length
        ? new Date(Math.min(...transfers.map((t) => t.timestamp))).toISOString()
        : null;
      if (!stopHere) {
        emit({
          type: "read",
          address: item.address,
          depth: item.depth,
          transfers: transfers.length,
          outflows: outAll.length,
          apiCalls: grid.apiCalls,
        });
      }

      // The root sets the scale for every figure below it.
      if (item.address === root && req.amount === "auto") {
        reported = outAll.reduce((sum, t) => sum + t.value, 0);
      }
      const dust = reported * DUST_FRACTION;

      // What this wallet actually did, before the five-largest cut below. Three
      // behavioural rules need the uncapped picture; scoring the pruned trace
      // instead is what left them unable to fire at all. See risk.ts.
      observed.set(item.address, {
        outValues: outAll.map((t) => t.value),
        historyComplete: !grid.wasTruncated(item.address),
      });

      nodes.set(item.address, {
        address: item.address,
        depth: item.depth,
        label,
        taintedValueUsdt: reported * item.taint,
        taintFraction: item.taint,
        firstSeen,
        outflowCount: outAll.length,
      });

      // Stop at the first attributable wallet — that is the finding.
      if (stopHere || item.depth >= MAX_DEPTH) continue;

      // Taint splits by share of everything that left after the fraud, so dust
      // dropped below still counts against the denominator rather than
      // inflating the branches we do follow.
      const totalOut = outAll.reduce((sum, t) => sum + t.value, 0);
      if (totalOut <= 0) continue;

      const followed = [...outAll]
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_OUTFLOWS)
        .filter((t) => t.value >= dust);

      const heldSince = receivedAt.get(item.address) ?? fraudAt;

      for (const t of followed) {
        edges.push({
          from: t.from,
          to: t.to,
          valueUsdt: t.value,
          txHash: t.txHash,
          timestamp: new Date(t.timestamp).toISOString(),
          dwellSeconds:
            Number.isFinite(heldSince) && t.timestamp > heldSince
              ? Math.round((t.timestamp - heldSince) / 1000)
              : null,
        });

        if (!receivedAt.has(t.to)) receivedAt.set(t.to, t.timestamp);
        next.push({
          address: t.to,
          depth: item.depth + 1,
          taint: item.taint * (t.value / totalOut),
        });
      }
    }

    queue = next;
  }

  // If the subject address itself could not be read, there is no finding to
  // state. Saying "no transfers were observed" when the endpoint refused to
  // answer is the same lie as calling an unread wallet "funds at rest" — it
  // just happens at depth 0, where it is most damaging.
  if (grid.didFail(root)) {
    throw new Error(
      "The chain could not be read for this address — the public endpoint is rate-limiting this deployment. No finding can be stated from an unread wallet.",
    );
  }

  const nodeList = [...nodes.values()];
  // Wallets we could not read are excluded from the "funds at rest" finding.
  const unread = new Set(nodeList.filter((n) => grid.didFail(n.address)).map((n) => n.address));
  const fraudIso = new Date(Number.isNaN(fraudAt) ? Date.now() : fraudAt).toISOString();
  emit({ type: "scoring", wallets: nodeList.length, transfers: edges.length });
  const riskFlags = scoreRisk(nodeList, edges, fraudIso, {
    observed,
    fraudDateReported: req.fraudDate !== "auto",
  });
  const { triage, triageReason, terminal } = decide(nodeList, reported, unread);

  return {
    caseId: caseIdFor(root, fraudIso),
    inputAddress: root,
    chain: "tron",
    reportedAmountUsdt: reported,
    fraudDate: fraudIso,
    nodes: nodeList,
    edges,
    terminal,
    riskFlags,
    triage,
    triageReason,
    provenance: {
      apiCalls: grid.apiCalls,
      responseHashes: grid.responseHashes,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * The disposition. This is the differentiator: everyone traces, nobody triages.
 * Order matters — a mixer closes a case even if an exchange was also touched.
 */
function decide(
  nodes: TraceNode[],
  reportedAmount: number,
  unread: Set<string>,
): Pick<TraceResult, "triage" | "triageReason" | "terminal"> {
  const byTaint = [...nodes].sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt);
  const usdt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  // Only wallets the money actually reached can be the finding — depth 0 is
  // the reported address itself.
  const reached = byTaint.filter((n) => n.depth > 0);

  const blocked = reached.find(
    (n) => n.label?.kind === "mixer" || n.label?.kind === "sanctioned",
  );
  if (blocked && blocked.label) {
    return {
      triage: "COLD" as TriageLevel,
      triageReason: `${usdt(blocked.taintedValueUsdt)} USDT of the reported amount reached ${blocked.label.entity}; the trail cannot be followed deterministically past that point, so the case should be documented and closed.`,
      terminal: {
        address: blocked.address,
        label: blocked.label,
        depositAddress: null,
      },
    };
  }

  const exit = reached.find(
    (n) => n.label?.kind === "exchange_deposit" || n.label?.kind === "exchange_hot",
  );
  if (exit && exit.label) {
    const isDeposit = exit.label.kind === "exchange_deposit";
    return {
      triage: "WARM" as TriageLevel,
      triageReason: isDeposit
        ? `${usdt(exit.taintedValueUsdt)} USDT reached a likely ${exit.label.entity} customer deposit address; a freeze request naming that address is viable.`
        : `${usdt(exit.taintedValueUsdt)} USDT reached a ${exit.label.entity} wallet; the exchange can be asked to identify the receiving account.`,
      terminal: {
        address: exit.address,
        label: exit.label,
        depositAddress: isDeposit ? exit.address : null,
      },
    };
  }

  const atRest = reached.find((n) => n.outflowCount === 0 && !unread.has(n.address));
  if (atRest) {
    return {
      triage: "HOT" as TriageLevel,
      triageReason: `${usdt(atRest.taintedValueUsdt)} USDT is sitting at an unattributed address with no outgoing transfers — the money has not reached an off-ramp yet and can still be acted on.`,
      terminal: null,
    };
  }

  // The trail is still moving and nothing on it is attributable. Not an exit,
  // so not WARM; not at rest, so the HOT sentence has to say what it is.
  return {
    triage: "HOT" as TriageLevel,
    triageReason:
      nodes.length > 1
        ? "No exit was identified within three hops and the trail is still moving; none of the wallets on it are attributable from the label tables held here."
        : `No transfers were observed leaving this address after the reported fraud, so ${usdt(reportedAmount)} USDT may still be recoverable.`,
    terminal: null,
  };
}
