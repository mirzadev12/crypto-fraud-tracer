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
 * And one rule that is not a limit but causality: a wallet the money reached is
 * followed only through what it sent *after* the money arrived. A transfer made
 * before the victim's money got there cannot contain any of it.
 *
 * Taint is what makes this evidence rather than a picture. A wallet that
 * received 40% of its parent's outgoing value inherits 40% of the parent's
 * taint, so the result can say "46,208 USDT of the victim's money reached this
 * address" instead of "this address exists".
 */

import { isTerminal, lookup } from "./labels";
import { buildNarrative } from "./narrative";
import { scoreRisk, type Observed } from "./risk";
import type { TraceProgress } from "./progress";
import { TronGrid, type Trc20Transfer } from "./trongrid";
import type { Label, TraceEdge, TraceNode, TraceResult, TriageLevel } from "./types";

const MAX_DEPTH = 3;
const TOP_OUTFLOWS = 5;
const DUST_FRACTION = 0.01;
const DAY_MS = 86_400_000;

/**
 * USDT has six decimals, so no figure here means anything past the sixth.
 * Summing transfers in floating point leaves noise beyond it — a recorded case
 * once carried a reported amount of 3482.7000000000003 — and that noise then
 * shows up in the JSON an integrator reads and in every product downstream.
 */
function micro(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** The latest entry in an ascending list that is at or before `at`, or null. */
function latestAtOrBefore(sorted: number[], at: number): number | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= at) {
      found = sorted[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** "14 September 2026, 08:31 UTC" — for a boundary that falls inside a day. */
function momentUtc(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "an unrecorded moment";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dayUtc(ms)}, ${hh}:${mm} UTC`;
}

function dayUtc(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "an unrecorded date";
  return `${d.getUTCDate()} ${
    [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

/**
 * How stolen money is followed once it mixes with other money in a wallet.
 *
 * This is the question every serious tracing argument turns on, and there is no
 * single right answer — only rules, each with a cost. A wallet holding 9,000
 * USDT receives 1,000 of the victim's, then sends 1,000 onward:
 *
 *   haircut  The wallet is 10% tainted, so everything leaving is 10% tainted:
 *            100 USDT of the victim's money left. Conservative, never
 *            over-claims, and *dilutes* — a launderer defeats it by routing
 *            through high-volume wallets until the share rounds to nothing.
 *
 *   fifo     First in, first out. The clean 9,000 arrived first, so it leaves
 *            first: none of the victim's money has left yet. Harder to dilute
 *            on purpose, and it is the rule English courts have reached for on
 *            mixed funds since Clayton's Case (1816).
 *
 * Both are defensible and they disagree, sometimes by an order of magnitude.
 * Running the trace under each brackets the answer instead of asserting one,
 * which is the honest thing to put in front of an officer — and it is the
 * answer to the sharpest question this method faces: what happens when the
 * criminal mixes stolen funds with clean ones.
 *
 * Not implemented: poison (every wallet that touches the money is wholly
 * tainted) taints bystanders within a couple of hops, and LIFO is FIFO's mirror
 * with no legal tradition behind it. Neither would tell an investigator
 * anything these two do not.
 */
export type TaintModel = "haircut" | "fifo";

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
  /** How taint survives mixing. Defaults to haircut, which is what shipped. */
  model?: TaintModel;
  /**
   * ISO timestamp. Read the chain as it stood at this moment rather than now.
   *
   * Confirmed transfers never change, so a trace run as of a past moment comes
   * out the same on any later day. That is what lets a recorded case be
   * re-derived after a rule changes — the wallets' later activity cannot leak
   * into it — and it is the strongest form the evidence can take: not only can
   * each transaction be re-read, the whole case can be recomputed.
   */
  asOf?: string;
}

/**
 * FIFO: which part of each outflow is the victim's money.
 *
 * The wallet is a queue. Whatever it already held when the tainted money
 * arrived leaves first, then the tainted tranche, then anything that arrived
 * afterwards. So an outflow before the money arrived carries none of it, and an
 * outflow after it carries the victim's money only once the earlier balance is
 * exhausted.
 *
 * `outflows` must be the wallet's whole read history of outgoing transfers, not
 * only those after the fraud date: the opening balance is everything that came
 * in before the money arrived less everything that went out before it, and
 * leaving the older outflows out would count money that came and went years
 * ago as still sitting ahead of the victim's.
 *
 * The simplification, stated because it bounds what the number means: one
 * tainted tranche per wallet, at the moment this trace first reached it. A
 * wallet the money reached twice by different routes is treated as receiving
 * the larger share once — which is the same assumption the rest of the tracer
 * already makes when it keeps the larger taint for a wallet reached twice.
 */
function fifoShares(
  outflows: Trc20Transfer[],
  inflows: Trc20Transfer[],
  arrivedAt: number,
  taintedValue: number,
): Map<string, number> {
  // What the wallet already held, unspent, at the moment the tainted money
  // landed. Read from the transfers rather than assumed: a wallet with no prior
  // history has nothing to pay out first, and the taint leaves immediately.
  let priorIn = 0;
  for (const t of inflows) if (t.timestamp < arrivedAt) priorIn += t.value;
  let priorOut = 0;
  for (const t of outflows) if (t.timestamp < arrivedAt) priorOut += t.value;

  let clean = Math.max(0, priorIn - priorOut);
  let dirty = taintedValue;

  const shares = new Map<string, number>();
  for (const t of [...outflows].sort((a, b) => a.timestamp - b.timestamp)) {
    if (t.timestamp < arrivedAt) continue; // paid out before the money arrived
    let need = t.value;
    const fromClean = Math.min(clean, need);
    clean -= fromClean;
    need -= fromClean;
    const fromDirty = Math.min(dirty, need);
    dirty -= fromDirty;
    if (fromDirty > 0) shares.set(t.txHash, fromDirty);
  }
  return shares;
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

  // "Now", unless the trace is being run as of a past moment.
  const asOfMs = req.asOf ? new Date(req.asOf).getTime() : Number.NaN;
  const asOf = Number.isFinite(asOfMs) ? asOfMs : null;
  const now = () => asOf ?? Date.now();

  // Resolved from the subject wallet's own history when the caller said "auto".
  let fraudAt = req.fraudDate === "auto" ? Number.NaN : new Date(req.fraudDate).getTime();

  // Resolved from the root's own transfers when the caller said "auto".
  let reported = typeof req.amount === "number" ? Math.max(0, req.amount) : 0;

  const model: TaintModel = req.model ?? "haircut";
  const grid = new TronGrid({ asOf });
  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  /** Per wallet, what was read before this tracer's own limits pruned it. */
  const observed = new Map<string, Observed>();

  /**
   * When the victim's money first reached each wallet: the earliest transfer
   * that brought it. It bounds what that wallet is followed through, and it is
   * where its dwell time is measured from.
   */
  const receivedAt = new Map<string, number>();

  /**
   * Wallets whose state since the money arrived we cannot vouch for — never
   * read, or read only in part with the part that matters missing. None of
   * them may be reported as holding the money: saying funds are at rest
   * because we could not see them move is the one lie this tool must never tell.
   */
  const unseen = new Set<string>();

  /** What reached the reported wallet inside the window — see `decide`. */
  let rootReceived = 0;
  /**
   * Set only when we hold just the newest part of the reported wallet's
   * history and that part starts after the window opens: the oldest transfer
   * we could read. What arrived after it is known; what happened before it,
   * inside the window, is not.
   */
  let rootReadFrom: number | null = null;

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
    /*
     * Collapse duplicate addresses within this hop before processing any of
     * them, keeping the larger share of the victim's money for each.
     *
     * Without this, a fan-in — several wallets converging on one address, which
     * is the consolidation pattern `lib/links.ts` exists to find — could queue
     * the same address twice in one hop and walk it twice, putting every one of
     * its transfers into the case file twice and inflating the fan-out and
     * round-amount rules on exactly the shape this product exists to find.
     */
    const merged = new Map<string, (typeof queue)[number]>();
    for (const item of queue) {
      const prior = merged.get(item.address);
      if (!prior || item.taint > prior.taint) merged.set(item.address, item);
    }
    queue = [...merged.values()];

    const next: typeof queue = [];
    emit({ type: "hop", depth: queue[0].depth, wallets: queue.length });

    for (const item of queue) {
      /*
       * A wallet reached again by a later route keeps the larger share of the
       * victim's money, but it is never walked a second time. The earlier code
       * walked it again whenever the later route carried more, which listed
       * every one of its transfers twice and re-filed it one hop deeper than the
       * transfer that first reached it — the same fault the merge above fixes
       * within a hop, arriving across hops instead.
       */
      const existing = nodes.get(item.address);
      if (existing) {
        if (item.taint > existing.taintFraction) {
          existing.taintFraction = item.taint;
          existing.taintedValueUsdt = micro(reported * item.taint);
        }
        continue;
      }

      const isRoot = item.address === root;
      const label = isRoot ? rootLabel : lookup(item.address);
      const stopHere = !isRoot && isTerminal(label);
      if (label && !isRoot) {
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
      if (isRoot && Number.isNaN(fraudAt)) {
        const earliest = transfers.length
          ? Math.min(...transfers.map((t) => t.timestamp))
          : now() - 365 * DAY_MS;
        fraudAt = earliest - 1000;
        emit({ type: "window", since: new Date(fraudAt).toISOString() });
      }

      // When the money this trace is following reached this wallet. For the
      // reported wallet that is the fraud date, the window everything else is
      // measured from; for every other wallet, the transfer that brought it.
      const arrivedAt = isRoot ? fraudAt : (receivedAt.get(item.address) ?? fraudAt);

      /*
       * Only what left after the money arrived can be carrying it. The reported
       * wallet is followed through everything it sent after the fraud date.
       * Every other wallet is followed only through what it sent at or after
       * the moment the money reached it: an outflow made before that cannot
       * contain any of it, however soon after the fraud it happened, and
       * following it would put a wallet in the case that the victim's money
       * never touched — or stop a wallet that is still holding the money from
       * being recognised as holding it.
       */
      const outAll = transfers.filter(
        (t) =>
          t.from === item.address &&
          (isRoot ? t.timestamp > arrivedAt : t.timestamp >= arrivedAt),
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

      /*
       * Receipts into the reported wallet, oldest first. They are what its
       * dwell time is measured from. The victim's own payment is not something
       * this trace can single out, so each outflow is measured from the latest
       * USDT the wallet actually received before sending it — a transfer that
       * happened, never the fraud date. Measuring from the fraud date is what
       * once turned a capture script's choice of date into a "forwarded within
       * one minute" finding on eight recorded cases.
       */
      const rootReceipts = isRoot
        ? transfers
            .filter((t) => t.to === root && t.from !== root)
            .map((t) => t.timestamp)
            .sort((a, b) => a - b)
        : [];

      if (isRoot) {
        rootReceived = micro(
          transfers
            .filter((t) => t.to === root && t.from !== root && t.timestamp > fraudAt)
            .reduce((sum, t) => sum + t.value, 0),
        );
        // The root sets the scale for every figure below it. With no amount
        // reported: everything that left after the window opened — or, when
        // nothing left, what arrived and is still there, which is the figure an
        // at-rest case is about. Never a zero for money that is sitting there.
        if (req.amount === "auto") {
          const left = micro(outAll.reduce((sum, t) => sum + t.value, 0));
          reported = left > 0 ? left : rootReceived;
        }
        if (grid.wasTruncated(root) && transfers.length) {
          const oldestRead = Math.min(...transfers.map((t) => t.timestamp));
          if (oldestRead > fraudAt) rootReadFrom = oldestRead;
        }
      }
      const dust = reported * DUST_FRACTION;

      // What this wallet actually did, before the five-largest cut below. Three
      // behavioural rules need the uncapped picture; scoring the pruned trace
      // instead is what left them unable to fire at all. See risk.ts.
      observed.set(item.address, {
        outValues: outAll.map((t) => t.value),
        recipients: new Set(outAll.map((t) => t.to)).size,
        historyComplete: !grid.wasTruncated(item.address),
      });

      /*
       * Can we vouch for what this wallet did after the money arrived? Not if
       * the chain never answered for it. And not if we hold only the newest
       * part of its history and that part starts after the money arrived: the
       * transfers in between are exactly the ones that would say it moved.
       */
      if (!stopHere && !isRoot) {
        if (grid.didFail(item.address)) {
          unseen.add(item.address);
        } else if (grid.wasTruncated(item.address)) {
          const oldestRead = transfers.length
            ? Math.min(...transfers.map((t) => t.timestamp))
            : Number.POSITIVE_INFINITY;
          if (!(oldestRead <= arrivedAt)) unseen.add(item.address);
        }
      }

      nodes.set(item.address, {
        address: item.address,
        depth: item.depth,
        label,
        taintedValueUsdt: micro(reported * item.taint),
        taintFraction: item.taint,
        firstSeen,
        outflowCount: outAll.length,
      });

      // Stop at the first attributable wallet — that is the finding.
      if (stopHere || item.depth >= MAX_DEPTH) continue;

      // Taint splits by share of everything that left after the money arrived,
      // so dust dropped below still counts against the denominator rather than
      // inflating the branches we do follow.
      const totalOut = outAll.reduce((sum, t) => sum + t.value, 0);
      if (totalOut <= 0) continue;

      const followed = [...outAll]
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_OUTFLOWS)
        .filter((t) => t.value >= dust);

      /*
       * Under FIFO the split depends on when each transfer happened and what
       * the wallet already held, so it is computed once per wallet over every
       * outflow — not just the five we follow — or the shares would be drawn
       * from a queue the pruning had already emptied.
       */
      const fifo =
        model === "fifo"
          ? fifoShares(
              transfers.filter((t) => t.from === item.address),
              transfers.filter((t) => t.to === item.address),
              arrivedAt,
              reported * item.taint,
            )
          : null;

      for (const t of followed) {
        const since = isRoot ? latestAtOrBefore(rootReceipts, t.timestamp) : arrivedAt;
        edges.push({
          from: t.from,
          to: t.to,
          valueUsdt: t.value,
          txHash: t.txHash,
          timestamp: new Date(t.timestamp).toISOString(),
          dwellSeconds:
            since !== null && Number.isFinite(since) && t.timestamp >= since
              ? Math.round((t.timestamp - since) / 1000)
              : null,
        });

        // The earliest arrival wins, and only for a wallet not yet walked: its
        // window is fixed the moment it is processed.
        if (!nodes.has(t.to)) {
          const prior = receivedAt.get(t.to);
          if (prior === undefined || t.timestamp < prior) receivedAt.set(t.to, t.timestamp);
        }
        /*
         * Haircut splits a wallet's taint across what it sent in proportion to
         * value — but a transfer cannot carry more of the victim's money than
         * it moved. When a wallet sent on less than the victim money that
         * reached it (a reported loss larger than what left the reported
         * wallet is the usual way), the proportional share alone would assign
         * a 500 USDT transfer 2,000 USDT of taint. The cap keeps haircut true
         * to its one promise: it never over-claims. What is not carried on
         * stayed in the wallet.
         */
        const share = item.taint * (t.value / totalOut);
        next.push({
          address: t.to,
          depth: item.depth + 1,
          taint: fifo
            ? // A share of the reported amount, so the units match haircut's.
              reported > 0
              ? (fifo.get(t.txHash) ?? 0) / reported
              : 0
            : reported > 0
              ? Math.min(share, t.value / reported)
              : share,
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
  const fraudIso = new Date(Number.isNaN(fraudAt) ? now() : fraudAt).toISOString();
  emit({ type: "scoring", wallets: nodeList.length, transfers: edges.length });
  const riskFlags = scoreRisk(nodeList, edges, fraudIso, {
    observed,
    fraudDateReported: req.fraudDate !== "auto",
  });
  const { triage, triageReason, terminal, restingAt } = decide(nodeList, {
    rootFollowed: edges.filter((e) => e.from === root).length,
    unseen,
    rootReceived,
    rootReadFrom,
    windowStart: Number.isNaN(fraudAt) ? now() : fraudAt,
    fraudDateReported: req.fraudDate !== "auto",
  });

  const result: TraceResult = {
    caseId: caseIdFor(root, fraudIso),
    inputAddress: root,
    chain: "tron",
    reportedAmountUsdt: micro(reported),
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
      // An as-of trace is stamped with the moment it describes, not the moment
      // it was computed: every age on screen is measured from this, and the
      // chain it read is the chain as it stood then.
      generatedAt: new Date(now()).toISOString(),
    },
  };

  // Assembled from the finished result, so it can never disagree with the
  // figures printed beside it. Deterministic — no model, no key, no cache.
  const narrative = buildNarrative(result, {
    amountReported: req.amount !== "auto",
    restingAt,
  });
  return narrative ? { ...result, narrative } : result;
}

/**
 * The disposition. This is the differentiator: everyone traces, nobody triages.
 * Order matters — a mixer closes a case even if an exchange was also touched.
 */
function decide(
  nodes: TraceNode[],
  ctx: {
    /** How many transfers out of the reported wallet this trace followed. */
    rootFollowed: number;
    /** Wallets whose state since the money arrived cannot be vouched for. */
    unseen: Set<string>;
    /** USDT that reached the reported wallet inside the window. */
    rootReceived: number;
    /** Oldest transfer read, when only the newest part of the history was. */
    rootReadFrom: number | null;
    windowStart: number;
    fraudDateReported: boolean;
  },
): Pick<TraceResult, "triage" | "triageReason" | "terminal"> & {
  /** The wallet named as holding the money, when the finding names one. */
  restingAt: string | null;
} {
  const byTaint = [...nodes].sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt);
  const usdt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  // Only wallets the money actually reached can be the finding — depth 0 is
  // the reported address itself, and a wallet carrying none of the victim's
  // money is on the canvas because a transfer to it was followed, not because
  // the money got there. Under FIFO that is common: the largest transfers can
  // all precede the victim's tranche, and "0 USDT reached a Binance wallet"
  // is not a finding.
  const reached = byTaint.filter((n) => n.depth > 0 && n.taintedValueUsdt > 0);

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
      restingAt: null,
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
      restingAt: null,
    };
  }

  // A wallet the money reached that has sent nothing since — and that we
  // actually read. `firstSeen` is null only for a wallet that returned no
  // history at all, which for a wallet the money provably reached means the
  // chain did not answer for it.
  const atRest = reached.find(
    (n) => n.outflowCount === 0 && !ctx.unseen.has(n.address) && n.firstSeen !== null,
  );
  if (atRest) {
    return {
      triage: "HOT" as TriageLevel,
      triageReason: `${usdt(atRest.taintedValueUsdt)} USDT is sitting at an unattributed address that has made no outgoing transfer since the money arrived — it has not reached an off-ramp yet and can still be acted on.`,
      terminal: null,
      restingAt: atRest.address,
    };
  }

  const since = ctx.fraudDateReported
    ? `after the reported fraud on ${dayUtc(ctx.windowStart)}`
    : "since its first transfer on record";

  if (reached.length > 0) {
    // Everything the money reached is unreadable: where it is now is unknown,
    // and neither "still moving" nor "at rest" can be said.
    if (reached.every((n) => ctx.unseen.has(n.address))) {
      return {
        triage: "HOT" as TriageLevel,
        triageReason:
          "Money left this address, but the wallets it went to could not be read, so where it is now cannot be stated. Run the trace again before acting on it.",
        terminal: null,
        restingAt: null,
      };
    }
    // The trail is still moving and nothing on it is attributable. Not an
    // exit, so not WARM; not at rest, so the HOT sentence has to say what it is.
    return {
      triage: "HOT" as TriageLevel,
      triageReason:
        "No exit was identified within three hops and the trail is still moving; none of the wallets on it are attributable from the label tables held here.",
      terminal: null,
      restingAt: null,
    };
  }

  const subject = nodes.find((n) => n.depth === 0);
  if (subject && subject.outflowCount > 0) {
    return {
      triage: "HOT" as TriageLevel,
      triageReason:
        ctx.rootFollowed > 0
          ? // Transfers were followed, and the taint model put none of the
            // victim's money on any of them.
            `USDT left this address ${since}, but under this taint model none of the transfers followed here carried the traced amount; it left through smaller transfers this trace does not follow, so where it went cannot be stated from this trace.`
          : // Transfers left, but every one was below the share this trace follows.
            `USDT left this address ${since}, but only in transfers each smaller than 1% of the amount traced, which this trace does not follow; the money has not been seen reaching an off-ramp.`,
      terminal: null,
      restingAt: null,
    };
  }

  if (ctx.rootReceived > 0) {
    return {
      triage: "HOT" as TriageLevel,
      // With only the newest part of the history read, what arrived in that
      // part and has not left is a floor on what is sitting here — true
      // whatever the older part says — and is stated as one.
      triageReason:
        ctx.rootReadFrom === null
          ? `${usdt(ctx.rootReceived)} USDT arrived at this address ${since} and none of it has left — it has not reached an off-ramp and can still be acted on.`
          : `At least ${usdt(ctx.rootReceived)} USDT is sitting at this address: that much arrived in the newest part of its history that could be read, back to ${momentUtc(ctx.rootReadFrom)}, and none of it has left. Its older transfers were not read, so the real figure may be higher.`,
      terminal: null,
      restingAt: null,
    };
  }

  // Nothing came in and nothing went out inside the window. Calling that
  // CRITICAL would send an officer after money this address never held.
  if (subject && subject.firstSeen === null) {
    return {
      triage: "COLD" as TriageLevel,
      triageReason:
        "No USDT transfer has ever been recorded for this address, so there is nothing to follow. Check the address against the complaint.",
      terminal: null,
      restingAt: null,
    };
  }
  return {
    triage: "COLD" as TriageLevel,
    triageReason: `No USDT moved in or out of this address ${since}, so there is nothing to follow from here. Check the address and the date against the complaint.`,
    terminal: null,
    restingAt: null,
  };
}
