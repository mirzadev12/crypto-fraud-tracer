/**
 * The four sentences an officer pastes into a case file.
 *
 * AGENTS.md §11 offers this as an optional feature and suggests sending the
 * finished trace to a hosted language model for prose. This does not do that,
 * and the reason is the same one §11 itself raises: the defensive answer to
 * "what if the model hallucinates the exchange name" is *"it can't — attribution
 * is a deterministic lookup"*. That answer is stronger when it covers the whole
 * product rather than everything except the paragraph on the page.
 *
 * So the summary is assembled from the trace's own computed figures. Nothing
 * here decides anything: every number was already in the `TraceResult`, every
 * entity name comes through `entityPhrase`, and the same trace always produces
 * the same sentences. No key, no network call, no model, and nothing to cache
 * before a demo.
 *
 * It is also the honest thing to render under a heading that says "Summary" in
 * a document an officer signs — a generated paraphrase could drift from the
 * evidence printed six inches above it, and this cannot.
 */

import { categoryOf } from "./contracts";
import { entityPhrase } from "./voice";
import type { TraceResult } from "./types";

function usdt(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function whenUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an unrecorded date";
  return `${d.getUTCDate()} ${
    [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

function minutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? "one minute" : `${m} minutes`;
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/**
 * `entityPhrase` is written for a heading, so it opens with a capital and no
 * article — "Likely Bybit deposit cluster". Dropped into the middle of a
 * sentence that reads as a typo. The wording itself is not changed: the hedge
 * stays exactly where the attribution rule put it.
 */
function midSentence(phrase: string): string {
  if (phrase.startsWith("Likely ")) return `a likely ${phrase.slice(7)}`;
  // A plainly named wallet ("Binance hot wallet", "Bybit deposit address") needs
  // an article too, or the sentence reads "reached Binance hot wallet". "the" is
  // always grammatical in front of a named wallet; guessing a/an from the first
  // letter is not ("an MEXC", "a OKX").
  if (/(hot wallet|deposit address)$/.test(phrase)) return `the ${phrase}`;
  return phrase;
}

/** What the disposition asks of the reader, without restating the finding. */
const ACTION: Record<TraceResult["triage"], string> = {
  HOT: "The money has not reached an off-ramp and can still be acted on.",
  WARM: "A restraint request naming that account is viable.",
  COLD: "The trail cannot be followed deterministically past that point, so the case should be documented and closed.",
};

/**
 * What only the tracer knows, and the summary needs to say it truthfully.
 * Both are optional so a stored trace can still be summarised on its own.
 */
export interface NarrativeContext {
  /**
   * Whether the amount was reported by the complainant. When it was not, it is
   * everything that left the wallet, and "N USDT left" is a measurement; when
   * it was, it is the complaint's figure, and the summary must not present it
   * as something the chain showed leaving.
   */
  amountReported?: boolean;
  /**
   * The wallet the disposition names as holding the money, or null when it
   * names none. The tracer decides this with information a stored trace does
   * not carry — which wallets could not be read — so its answer is used
   * whenever it is available instead of being re-derived here.
   */
  restingAt?: string | null;
}

/**
 * Assemble the summary. Returns null when there is nothing to summarise — an
 * empty paragraph is worse than no paragraph in a filed document.
 */
export function buildNarrative(
  trace: TraceResult,
  context: NarrativeContext = {},
): string | null {
  const sentences: string[] = [];
  const hops = Math.max(0, ...trace.nodes.map((n) => n.depth));

  /* 1 — what left, and when. */
  const subject = trace.nodes.find((n) => n.depth === 0);
  if (subject && subject.firstSeen === null) {
    // No history at all. A date here would only be the default window the
    // tracer opened, and would read as if something was looked for after it.
    sentences.push(`No USDT transfer is on record for ${trace.inputAddress}.`);
  } else if (trace.edges.length === 0) {
    sentences.push(
      `No USDT left ${trace.inputAddress} after ${whenUtc(trace.fraudDate)} in the transfers examined.`,
    );
  } else {
    const route = `${
      trace.edges.length === 1 ? "one transfer" : `${trace.edges.length} transfers`
    } and ${hops === 1 ? "one hop" : `${hops} hops`}`;
    sentences.push(
      context.amountReported
        ? `The reported ${usdt(trace.reportedAmountUsdt)} USDT was followed from the reported wallet after ${whenUtc(trace.fraudDate)}, across ${route}.`
        : `${usdt(trace.reportedAmountUsdt)} USDT left the reported wallet after ${whenUtc(trace.fraudDate)}, followed across ${route}.`,
    );
  }

  /* 2 — how it moved, if the timing says anything. */
  const fastest = trace.edges
    .filter((e) => e.dwellSeconds !== null)
    .sort((a, b) => (a.dwellSeconds ?? 0) - (b.dwellSeconds ?? 0))[0];
  if (fastest?.dwellSeconds != null && fastest.dwellSeconds < 600) {
    sentences.push(
      `The fastest onward transfer was made ${minutes(fastest.dwellSeconds)} after receipt, ` +
        `which is characteristic of automated forwarding rather than a person deciding.`,
    );
  }

  /* 3 — where it ended. The product's one claim, worded by the same rule the
     rest of the interface uses. */
  // A contract the trace stopped at (Ethereum): the USDT trail ends there.
  const pooled = trace.terminal
    ? undefined
    : [...trace.nodes]
        .filter((n) => n.depth > 0 && n.label?.kind === "contract" && n.taintedValueUsdt > 0)
        .sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
  if (trace.terminal) {
    const reached = trace.nodes.find((n) => n.address === trace.terminal?.address);
    const phrase = midSentence(entityPhrase(trace.terminal.label));
    const account = trace.terminal.depositAddress;
    const share = reached
      ? `${usdt(reached.taintedValueUsdt)} USDT, ${percent(reached.taintFraction)} of the reported amount,`
      : "The traced funds";
    sentences.push(
      `${share} reached ${phrase}${account ? `, customer deposit address ${account}` : ""}.`,
    );
  } else {
    // A wallet that returned no history at all shows zero outflows too, and
    // naming it as holding the money would state the one thing this tool must
    // never state: that funds are at rest because we could not see them move.
    const atRest =
      context.restingAt !== undefined
        ? trace.nodes.find((n) => n.address === context.restingAt)
        : [...trace.nodes]
            .filter((n) => n.depth > 0 && n.outflowCount === 0 && n.firstSeen !== null)
            .sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
    if (atRest) {
      sentences.push(
        `${usdt(atRest.taintedValueUsdt)} USDT is held at ${atRest.address}, ` +
          `which has made no outgoing transfer since it arrived.`,
      );
    } else if (pooled?.label) {
      const share = `${usdt(pooled.taintedValueUsdt)} USDT, ${percent(pooled.taintFraction)} of the reported amount,`;
      const category = categoryOf(pooled.label);
      sentences.push(
        category === "bridge"
          ? `${share} left Ethereum through ${pooled.label.entity}.`
          : category === "defi"
            ? `${share} entered ${pooled.label.entity}, a DeFi contract, where USDT stops being traceable as USDT.`
            : `${share} entered an unlabelled smart contract, where USDT stops being traceable as USDT.`,
      );
    }
  }

  /* 4 — what fired, and what the disposition asks of the reader. */
  if (trace.riskFlags.length) {
    const names = [...new Set(trace.riskFlags.map((f) => f.code.toLowerCase().replace(/_/g, " ")))];
    sentences.push(
      `${trace.riskFlags.length === 1 ? "One behavioural rule" : `${trace.riskFlags.length} behavioural rules`} ` +
        `fired on the path (${names.join(", ")}).`,
    );
  }
  // The action, not the finding again. `triageReason` restates the amount and
  // the entity, which sentence three has already said in full. A closed case
  // with no exit is one where nothing moved to follow, and "past that point"
  // would name a point that does not exist.
  const endedInContract =
    trace.triage === "HOT" &&
    !!pooled &&
    !trace.nodes.some(
      (n) => n.depth > 0 && !n.label && n.outflowCount === 0 && n.firstSeen !== null && n.taintedValueUsdt > 0,
    );
  sentences.push(
    trace.triage === "COLD" && !trace.terminal
      ? "There is nothing to follow from this address; check it against the complaint before the case is closed."
      : endedInContract && pooled?.label
        ? categoryOf(pooled.label) === "bridge"
          ? "The money has not reached an identified off-ramp; the next step is the bridge transaction, which names where it was delivered on the other network."
          : "The money has not reached an identified off-ramp; the next step is the transaction that sent it into the contract, which shows what came out and to whom."
        : ACTION[trace.triage],
  );

  const text = sentences.join(" ").replace(/\s+/g, " ").trim();
  return text.length ? text : null;
}
