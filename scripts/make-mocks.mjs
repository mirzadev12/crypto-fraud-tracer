// Regenerates the committed fixtures in public/mock.
//
//   node scripts/make-mocks.mjs public/mock
//
// The fixtures are what the UI renders while the trace API is being built, and
// what the frozen demo runs on. Addresses are valid TRON base58check strings
// generated for this repo; the Binance hot wallet referenced in the evidence
// string is real and tagged on Tronscan.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "public/mock";
const h = (s) => createHash("sha256").update(s).digest("hex");
const iso = (s) => new Date(s).toISOString();
const tx = (s) => h("tx:" + s);

const A = {
  victim1: "TS27ffk2xJ95nTMYvLjBimcpqaLNHGiw2S",
  victim2: "TYz6M2Fn2egsb15oNZdACtABKotmheGQiD",
  victim3: "TLtQgf2jiNt6aiAvuirZBwbL3SrBa5RKZS",
  victim4: "THDgxwhf5neEAEDm7VeVhxAk7XXqxqopQm",
  victim5: "TVDQnzYGxoXYJ7bzhsJNUm2odya94LsoR3",
  victim6: "TMNeo6BBQb3bBeZqeKr3wtDKQ2P6y3ihJ1",
  victim7: "TAEX8NDwAUF4AwzsAvo17o2vnHCeGerg6M",
  victim8: "TQGdaUeybYZQ8dD4jQaL2Zajuhun5hR6wz",
  hop1: "TAHZyA6zGn8g6PfXT2ttjp2vBixuL9zjkC",
  hop2: "TKLFPwVjvb8m8scjeq39Z1r1X2SJGQSjS9",
  hop3: "TDZMsqZDRJrgBdddxSHVZYW5WJv35MJudp",
  hop4: "TYjLscHtxZTaN4eb1YNh3zfrxsBSTgKHev",
  hop5: "TQEXwwwcyL33Pbv5Uh4GRPWFGXwNJhbMP1",
  hop6: "TDiHyQVNMWRHyLGkHi7msEguiQsk9Lbzoa",
  hop7: "TG7xDLEDK3HZ1i9QzArzFf3VCh3iti4t5C",
  dep1: "TVZohhKTzuCu6PRjwhCoSU7vSRBZMaiJKA",
  mixer1: "TX4DVrExtgF1YxrbVsTL5qaAM3peMNNDxK",
  rest1: "TCfVH34ZwQ5U7Z7LB5yaZJfLPKYPfD5qjf",
  peel1: "TMAbHSX7wBx6RmRo9wjuf9j7e3etFR61Rk",
  peel2: "TPEAbZkn2X9ncD9VQKkaxi7eVNuQQJZEZ9",
};

// Real Tronscan-tagged Binance hot wallet (source: tronscan.org). Used here as
// the sweep destination that makes dep1 a Binance customer deposit address.
const BINANCE_HOT_7 = "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf";

const edge = (from, to, valueUsdt, at, dwellSeconds) => ({
  from,
  to,
  valueUsdt,
  txHash: tx(from + to + at),
  timestamp: iso(at),
  dwellSeconds,
});

const binanceLabel = {
  entity: "Binance",
  kind: "exchange_deposit",
  confidence: 0.87,
  source: "heuristic",
  evidence: `12 sweeps, 97% of inflow forwarded to Binance-Hot 7 (${BINANCE_HOT_7})`,
};

const victimLabel = {
  entity: "Victim-reported address",
  kind: "victim_reported",
  confidence: 1,
  source: "ground_truth",
};

const mixerLabel = {
  entity: "TRON mixing service",
  kind: "mixer",
  confidence: 0.92,
  source: "community",
  evidence: "Listed as a mixing contract in data/risk-lists.json",
};

/* -------------------------------------------------------------------- WARM */
const warm = {
  caseId: "FX-2026-0417",
  inputAddress: A.victim1,
  chain: "tron",
  reportedAmountUsdt: 51200,
  fraudDate: "2026-08-29T09:14:00.000Z",
  nodes: [
    { address: A.victim1, depth: 0, label: victimLabel, taintedValueUsdt: 51200, taintFraction: 1, firstSeen: iso("2026-08-29T09:14:00Z"), outflowCount: 2 },
    { address: A.hop1, depth: 1, label: null, taintedValueUsdt: 35840, taintFraction: 0.7, firstSeen: iso("2026-08-23T02:11:00Z"), outflowCount: 1 },
    { address: A.hop2, depth: 1, label: null, taintedValueUsdt: 15360, taintFraction: 0.3, firstSeen: iso("2026-08-25T18:40:00Z"), outflowCount: 1 },
    { address: A.hop3, depth: 2, label: null, taintedValueUsdt: 34048, taintFraction: 0.665, firstSeen: iso("2026-08-23T05:02:00Z"), outflowCount: 1 },
    { address: A.hop7, depth: 2, label: null, taintedValueUsdt: 14592, taintFraction: 0.285, firstSeen: iso("2026-08-26T11:19:00Z"), outflowCount: 1 },
    { address: A.dep1, depth: 3, label: binanceLabel, taintedValueUsdt: 46208, taintFraction: 0.9025, firstSeen: iso("2026-07-12T04:02:00Z"), outflowCount: 12 },
  ],
  edges: [
    edge(A.victim1, A.hop1, 35840, "2026-08-29T09:21:00Z", 420),
    edge(A.victim1, A.hop2, 15360, "2026-08-29T09:23:00Z", 540),
    edge(A.hop1, A.hop3, 34048, "2026-08-29T09:31:00Z", 600),
    edge(A.hop2, A.hop7, 14592, "2026-08-29T09:34:00Z", 660),
    edge(A.hop3, A.dep1, 32345, "2026-08-29T09:39:00Z", 480),
    edge(A.hop7, A.dep1, 13863, "2026-08-29T09:41:00Z", 420),
  ],
  terminal: { address: A.dep1, label: binanceLabel, depositAddress: A.dep1 },
  riskFlags: [
    { code: "SHORT_DWELL", reason: "Funds forwarded within 7 minutes of receipt — indicates automated laundering, not manual movement.", atAddress: A.hop1 },
    { code: "ROUND_AMOUNTS", reason: "Round-figure transfer of 15,360 USDT suggests structured layering rather than ordinary payment activity.", atAddress: A.victim1 },
    { code: "NEW_ADDRESS", reason: "Receiving address was created 6 days before the reported fraud.", atAddress: A.hop3 },
  ],
  triage: "WARM",
  triageReason: "Funds reached a Binance customer deposit address 27 minutes after the reported fraud; a freeze request naming that deposit address is viable.",
  narrative:
    "51,200 USDT left the victim-reported address within 7 minutes of the reported fraud, split across two wallets, and reconverged at a single Binance customer deposit address on 29 August 2026. Dwell times under 11 minutes at every hop indicate an automated forwarding script rather than manual movement. 46,208 USDT of the victim's funds — 90% of the reported amount — reached that deposit address. The deposit address is attributed to Binance with 0.87 confidence from 12 observed sweeps into a Tronscan-tagged Binance hot wallet.",
  provenance: {
    apiCalls: 11,
    responseHashes: [h("warm-1"), h("warm-2"), h("warm-3"), h("warm-4"), h("warm-5")],
    generatedAt: iso("2026-08-29T11:02:13Z"),
  },
};

/* --------------------------------------------------------------------- HOT */
const hot = {
  caseId: "FX-2026-0421",
  inputAddress: A.victim2,
  chain: "tron",
  reportedAmountUsdt: 18500,
  fraudDate: "2026-09-06T17:40:00.000Z",
  nodes: [
    { address: A.victim2, depth: 0, label: victimLabel, taintedValueUsdt: 18500, taintFraction: 1, firstSeen: iso("2026-09-06T17:40:00Z"), outflowCount: 1 },
    { address: A.hop4, depth: 1, label: null, taintedValueUsdt: 18500, taintFraction: 1, firstSeen: iso("2026-09-04T09:30:00Z"), outflowCount: 1 },
    { address: A.rest1, depth: 2, label: null, taintedValueUsdt: 18315, taintFraction: 0.99, firstSeen: iso("2026-09-04T22:07:00Z"), outflowCount: 0 },
  ],
  edges: [
    edge(A.victim2, A.hop4, 18500, "2026-09-06T17:46:00Z", 360),
    edge(A.hop4, A.rest1, 18315, "2026-09-06T17:52:00Z", 360),
  ],
  terminal: null,
  riskFlags: [
    { code: "SHORT_DWELL", reason: "Funds forwarded within 6 minutes of receipt — indicates automated laundering, not manual movement.", atAddress: A.hop4 },
    { code: "NEW_ADDRESS", reason: "Receiving address was created 2 days before the reported fraud.", atAddress: A.rest1 },
  ],
  triage: "HOT",
  triageReason: "18,315 USDT is still sitting at an unlabelled address with no outgoing transfers — the money has not reached an off-ramp yet and can still be acted on.",
  narrative:
    "18,500 USDT left the victim-reported address six minutes after the reported fraud and moved through one intermediary before coming to rest. The terminal address has received the funds but has made no outgoing transfer, and both addresses in the path were created within three days of the fraud. Because the money has not yet reached an exchange, this case is the highest-value use of an investigator's time today.",
  provenance: {
    apiCalls: 6,
    responseHashes: [h("hot-1"), h("hot-2"), h("hot-3")],
    generatedAt: iso("2026-09-06T18:05:44Z"),
  },
};

/* -------------------------------------------------------------------- COLD */
const cold = {
  caseId: "FX-2026-0409",
  inputAddress: A.victim3,
  chain: "tron",
  reportedAmountUsdt: 240000,
  fraudDate: "2026-08-21T06:02:00.000Z",
  nodes: [
    { address: A.victim3, depth: 0, label: victimLabel, taintedValueUsdt: 240000, taintFraction: 1, firstSeen: iso("2026-08-21T06:02:00Z"), outflowCount: 3 },
    { address: A.hop5, depth: 1, label: null, taintedValueUsdt: 144000, taintFraction: 0.6, firstSeen: iso("2026-08-19T14:22:00Z"), outflowCount: 6 },
    { address: A.peel1, depth: 2, label: null, taintedValueUsdt: 24000, taintFraction: 0.1, firstSeen: iso("2026-08-20T03:11:00Z"), outflowCount: 1 },
    { address: A.peel2, depth: 2, label: null, taintedValueUsdt: 24000, taintFraction: 0.1, firstSeen: iso("2026-08-20T03:14:00Z"), outflowCount: 1 },
    { address: A.hop6, depth: 2, label: null, taintedValueUsdt: 96000, taintFraction: 0.4, firstSeen: iso("2026-08-20T08:45:00Z"), outflowCount: 1 },
    { address: A.mixer1, depth: 3, label: mixerLabel, taintedValueUsdt: 96000, taintFraction: 0.4, firstSeen: iso("2025-11-03T12:44:00Z"), outflowCount: 4188 },
  ],
  edges: [
    edge(A.victim3, A.hop5, 144000, "2026-08-21T06:09:00Z", 420),
    edge(A.hop5, A.peel1, 24000, "2026-08-21T06:18:00Z", 540),
    edge(A.hop5, A.peel2, 24000, "2026-08-21T06:24:00Z", 900),
    edge(A.hop5, A.hop6, 96000, "2026-08-21T06:31:00Z", 1320),
    edge(A.hop6, A.mixer1, 96000, "2026-08-21T06:44:00Z", 780),
  ],
  terminal: { address: A.mixer1, label: mixerLabel, depositAddress: null },
  riskFlags: [
    { code: "SANCTIONED_CONTACT", reason: "Path enters a known mixing service — deterministic tracing is not possible beyond this point.", atAddress: A.mixer1 },
    { code: "PEEL_CHAIN", reason: "Peel-chain pattern: 5 sequential small withdrawals from a bulk address while the remainder moved on.", atAddress: A.hop5 },
    { code: "HIGH_FANOUT", reason: "Funds split across 6 wallets in a single hop.", atAddress: A.hop5 },
    { code: "ROUND_AMOUNTS", reason: "Round-figure transfers of 24,000 USDT suggest structured layering.", atAddress: A.hop5 },
  ],
  triage: "COLD",
  triageReason: "96,000 USDT entered a mixing service 42 minutes after the reported fraud; the trail cannot be followed deterministically past that point, so the case should be documented and closed.",
  narrative:
    "240,000 USDT left the victim-reported address across three transfers, of which 144,000 USDT moved through a single intermediary that then split the funds six ways. Two peel-offs of 24,000 USDT each were followed by a 96,000 USDT transfer that entered a known mixing service 42 minutes after the reported fraud. No deterministic attribution is possible beyond the mixer entry point, which is recorded here as the end of the traceable path.",
  provenance: {
    apiCalls: 14,
    responseHashes: [h("cold-1"), h("cold-2"), h("cold-3"), h("cold-4")],
    generatedAt: iso("2026-08-21T08:30:02Z"),
  },
};

/* ------------------------------------------------------------------- CASES */

/*
 * The register is two kinds of row. The real ones are derived from the frozen
 * cases in data/demo-cases.json, so they always say what those cases say — they
 * were once typed into cases.json by hand, and re-running this script would
 * have silently dropped them from the register. The illustrative ones follow,
 * on addresses generated for this repository and never on the chain;
 * `isIllustrative` in lib/api.ts lists them so the interface can say so.
 */
const frozen = JSON.parse(readFileSync(new URL("../data/demo-cases.json", import.meta.url), "utf8"));
const real = frozen.cases.map(({ trace: t }) => ({
  caseId: t.caseId,
  inputAddress: t.inputAddress,
  reportedAmountUsdt: t.reportedAmountUsdt,
  fraudDate: t.fraudDate,
  triage: t.triage,
  terminalEntity: t.terminal ? t.terminal.label.entity : null,
}));

const illustrative = [
  { caseId: "FX-2026-0421", inputAddress: A.victim2, reportedAmountUsdt: 18500, fraudDate: "2026-09-06T17:40:00.000Z", triage: "HOT", terminalEntity: null },
  { caseId: "FX-2026-0420", inputAddress: A.victim4, reportedAmountUsdt: 7400, fraudDate: "2026-09-06T11:05:00.000Z", triage: "HOT", terminalEntity: null },
  { caseId: "FX-2026-0419", inputAddress: A.victim5, reportedAmountUsdt: 132500, fraudDate: "2026-09-04T20:18:00.000Z", triage: "WARM", terminalEntity: "OKX" },
  { caseId: "FX-2026-0417", inputAddress: A.victim1, reportedAmountUsdt: 51200, fraudDate: "2026-08-29T09:14:00.000Z", triage: "WARM", terminalEntity: "Binance" },
  { caseId: "FX-2026-0415", inputAddress: A.victim6, reportedAmountUsdt: 26300, fraudDate: "2026-08-27T14:52:00.000Z", triage: "WARM", terminalEntity: "Bybit" },
  { caseId: "FX-2026-0412", inputAddress: A.victim7, reportedAmountUsdt: 89000, fraudDate: "2026-08-24T08:36:00.000Z", triage: "COLD", terminalEntity: "TRON mixing service" },
  { caseId: "FX-2026-0409", inputAddress: A.victim3, reportedAmountUsdt: 240000, fraudDate: "2026-08-21T06:02:00.000Z", triage: "COLD", terminalEntity: "TRON mixing service" },
  { caseId: "FX-2026-0404", inputAddress: A.victim8, reportedAmountUsdt: 15750, fraudDate: "2026-08-18T19:27:00.000Z", triage: "WARM", terminalEntity: "Kucoin" },
];

const cases = [...real, ...illustrative];

const w = (name, v) => writeFileSync(join(OUT, name), JSON.stringify(v, null, 2) + "\n");
w("trace-warm.json", warm);
w("trace-hot.json", hot);
w("trace-cold.json", cold);
w("cases.json", cases);
console.log(`wrote 4 mock files to ${OUT} — register: ${real.length} real, ${illustrative.length} illustrative`);
