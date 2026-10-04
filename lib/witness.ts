/**
 * Preparing for court: the questions defence counsel puts about a tool's
 * finding, each answered from this case's own record, with the limit of that
 * answer stated beside it.
 *
 * Built like the summary (lib/narrative.ts): a pure function of the finished
 * trace, so it cannot drift from the evidence it describes, and no language
 * model writes any of it. It readies the officer to explain what the tool did
 * and did not do. It is not legal advice and cites no statute; the packet's
 * legal-basis line and the s.63(4) certificate are where the law is chosen.
 */
import { chainMeta } from "./chain-meta";
import { count, formatDateTime, formatPercent, formatUsdt } from "./format";
import { baseRateSentence } from "./rule-base-rates";
import { DUST_FRACTION, MAX_DEPTH, TOP_OUTFLOWS } from "./trace-limits";
import type { TraceResult } from "./types";
import { entityPhrase } from "./voice";

export interface WitnessItem {
  question: string;
  answer: string;
  /** What the answer does not establish. Said before counsel says it. */
  limit: string;
}

const MODEL_IN_WORDS = {
  haircut:
    "the haircut model: each wallet passes the victim's money on in proportion to what it sent, and no transfer carries more of it than it moved",
  fifo: "first-in-first-out: whatever a wallet already held leaves first, then the victim's money, the rule courts have applied to mixed funds since Clayton's Case",
} as const;

export function witnessSheet(
  trace: TraceResult,
  ctx: { fingerprint: string; recorded: boolean },
): WitnessItem[] {
  const items: WitnessItem[] = [];
  const chain = chainMeta(trace.chain).name;
  const model = trace.provenance.asked?.model ?? "haircut";
  const terminal = trace.terminal;
  const own = terminal !== null && terminal.address === trace.inputAddress;
  const reached = terminal ? trace.nodes.find((n) => n.address === terminal.address) : undefined;
  const read = formatDateTime(trace.provenance.generatedAt);

  /* 1 — whose money. */
  items.push({
    question: "How do you know this is the victim's money?",
    answer: own
      ? "The payment went straight into the reported address, and that address is itself attributed. No tracing step stands between the payment and the account."
      : terminal && reached
        ? `${formatUsdt(reached.taintedValueUsdt)} of the ${formatUsdt(trace.reportedAmountUsdt)} traced (${formatPercent(reached.taintFraction)}) reached the exit, following the transfers listed in the packet one by one. The share is computed under ${MODEL_IN_WORDS[model]}.`
        : `The trace followed ${formatUsdt(trace.reportedAmountUsdt)} out of the reported address across ${count(trace.edges.length, "transfer")}, each listed in the packet with its transaction hash, under ${MODEL_IN_WORDS[model]}.`,
    limit:
      "Where stolen money is mixed with other money, how much of a later transfer is the victim's is a model, not a fact. The two models FineX offers can disagree sharply on the same wallets; state the model whenever the figure is quoted.",
  });

  /* 2 — whose account. */
  if (terminal) {
    const label = terminal.label;
    const phrase = entityPhrase(label);
    items.push({
      question: "Who says this address belongs to that exchange, or that entity?",
      answer:
        label.source === "heuristic"
          ? `FineX derived it from public chain data: ${phrase}. The address received from unrelated payers and forwarded almost all of it to a wallet a public explorer tags as the exchange's${label.evidence ? ` (${label.evidence})` : ""}. Attribution confidence ${formatPercent(label.confidence)}.`
          : label.source === "sanctions"
            ? `The OFAC Specially Designated Nationals list names it: ${phrase}.`
            : `A public block explorer's tag names it: ${phrase}.`,
      limit:
        label.source === "heuristic"
          ? "Confidence measures how much sweep evidence was seen, not the probability that the attribution is right, and a merchant settling to one exchange can look the same. Only the exchange can confirm whose account it is; the request asks it to."
          : label.source === "sanctions"
            ? "A listing says who OFAC designated; it is a foreign designation and does not, by itself, carry legal force in India."
            : "A tag says whose wallet it is. It does not say which customer a payment was credited to; the exchange can, from the transaction hash.",
    });
  }

  /* 3 — what was read. */
  const unread = trace.nodes.filter((n) => n.depth > 0 && !n.label && n.firstSeen === null);
  items.push({
    question: "Was every wallet on the path actually read?",
    answer:
      unread.length === 0
        ? `Yes. Of the ${count(trace.nodes.length, "wallet")} on the path, every one without an attribution was read from the chain, and the SHA-256 of each of the ${count(trace.provenance.responseHashes.length, "response")} is listed in the packet's chain of custody.`
        : `${count(unread.length, "wallet")} could not be read: the chain did not answer for ${unread.length === 1 ? "it" : "them"}. The findings exclude ${unread.length === 1 ? "it" : "them"}, and no unread wallet is named as holding money.`,
    limit:
      "An attributed wallet, an exchange's for instance, is not read past the point the money reached it: it is the answer, not a place to keep looking.",
  });

  /* 4 — has it changed. */
  items.push({
    question: "How can the court be sure the findings have not changed since?",
    answer: `The findings carry a fingerprint beginning ${ctx.fingerprint.slice(0, 16)}. Anyone can re-derive them from the chain as it stood on ${read}, through the check link or QR code on the packet, and the fingerprint must come out the same. Confirmed transfers do not change, so the re-derivation reads exactly what this one read.`,
    limit:
      "The fingerprint covers the findings (wallets, amounts, rules, disposition), not the wording around them. What the money did after that moment is not in this packet; the desk's watch reports it.",
  });

  /* 5 — the address itself. */
  items.push({
    question: "Could the reported address be a look-alike the victim copied by mistake?",
    answer:
      "The address was traced exactly as entered. Look-alike (\"address poisoning\") transfers are usually worth nothing, and FineX ignores zero-value transfers when it reads a wallet.",
    limit:
      "Whether this is the address the victim actually paid is a question for the victim's own record: match it, character for character, against the transaction their exchange or wallet shows.",
  });

  /* 6 — who decided. */
  items.push({
    question: "Did software decide this?",
    answer:
      "No model decided anything in this packet. The disposition, the exit and every indicator are fixed rules applied to the chain's own records, and each indicator prints the evidence it rests on. One advisory model ranks unusual wallets for a closer look; no finding here depends on it.",
    limit:
      "A rule can be wrong in a particular case. That is why each one states its evidence, and why the indicators below carry the rate at which they fire on wallets nobody reported.",
  });

  /* 7 — how strong the indicators are. */
  if (trace.riskFlags.length > 0) {
    const codes = [...new Set(trace.riskFlags.map((f) => f.code))];
    items.push({
      question: "How strong are the laundering indicators?",
      answer: `${count(codes.length, "rule")} fired: ${codes.map((c) => c.toLowerCase().replace(/_/g, " ")).join(", ")}. ${
        baseRateSentence(codes) ?? "No base rate has been measured for these rules."
      }`,
      limit:
        "An indicator supports a finding; it does not make one. The base rates come from a sample of 17 wallets, enough to show which rules are weak and too few to tune their thresholds.",
    });
  } else {
    items.push({
      question: "How strong are the laundering indicators?",
      answer: "No behavioural rule fired. The finding rests on where the money went, not on how it moved.",
      limit: "An absence of indicators is not evidence that the money was not laundered.",
    });
  }

  /* 8 — what was not looked at. */
  items.push({
    question: "What did the trace not look at?",
    answer: `Anything more than ${count(MAX_DEPTH, "hop")} from the reported address; more than the ${TOP_OUTFLOWS} largest outflows of any wallet; transfers under ${Math.round(DUST_FRACTION * 100)}% of the reported amount; anything before ${formatDateTime(trace.fraudDate)}; and anything other than USDT on ${chain}.`,
    limit:
      "Money that left through a smaller transfer, a later hop, another asset or another chain is not followed. The packet's own limitations say the same.",
  });

  /* 9 — when, and by whom. */
  items.push({
    question: "When was the chain read, and by whom?",
    answer: ctx.recorded
      ? `${read}. This is a recorded case: captured from the chain at that moment and served from the case file, with the hash of every response it was built from.`
      : `${read}, by this deployment, reading the chain live. The server's audit log records which officer ID ran it.`,
    limit: ctx.recorded
      ? "The packet does not say who printed it; the officer who signs it vouches for that."
      : "Say whether that officer ID was only stated at sign-in or verified by the department's gateway; the audit log records which.",
  });

  return items;
}
