/**
 * How often does each rule fire on a wallet nobody reported?
 *
 * A rule that fires on everything carries no information. Three of the six
 * rules were repaired recently, and a first look at 24 exchange-facing wallets
 * had two of them firing on twenty — which is either a real property of that
 * population or a threshold set too low, and guessing which is not good enough
 * for a tool that asks an officer to act.
 *
 * So this measures it. Note carefully what the number is and is not:
 *
 *   It is a BASE RATE — how often a rule fires across a sample of wallets
 *   moving USDT on TRON that nobody has reported as fraud.
 *
 *   It is NOT a false-positive rate. We have no labelled fraud set, so we
 *   cannot know which of these wallets are innocent. Some of them will not be.
 *
 * That distinction has to survive into anything said out loud about the result.
 * A high base rate means a rule is not discriminating; it does not mean the
 * rule is wrong, and a low one does not mean the rule is right.
 *
 * The population is deliberately one hop back from the exchange: the wallets
 * that funded the wallets that pay exchange hot wallets. Sampling the
 * exchange-facing layer directly would stack the deck — fanning out and
 * peeling is ordinary business there — and one hop back is also where an
 * unlabelled intermediary lives, which is the only place NEW_ADDRESS can fire.
 *
 *   node scripts/calibrate-risk.mjs [port] [sampleSize]
 */

import { readFileSync } from "node:fs";

const PORT = process.argv[2] ?? "3000";
const SAMPLE = Number(process.argv[3] ?? 25);
const BASE = `http://localhost:${PORT}`;
const GRID = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const PACING_MS = 1400;
const DAY = 86_400_000;

const CODES = [
  "SHORT_DWELL",
  "HIGH_FANOUT",
  "PEEL_CHAIN",
  "ROUND_AMOUNTS",
  "NEW_ADDRESS",
  "SANCTIONED_CONTACT",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grid(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GRID}${path}`);
      if (res.status === 429) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(1500);
    }
  }
  return null;
}

const transfersOf = (address, limit = 200) =>
  grid(
    `/v1/accounts/${address}/transactions/trc20?limit=${limit}&only_confirmed=true&contract_address=${USDT}`,
  );

/* Everything we already carry a label for, so the sample stays unlabelled. */
const labelled = new Set();
for (const file of ["deposit-addresses", "hot-wallets"]) {
  for (const row of JSON.parse(
    readFileSync(new URL(`../data/${file}.json`, import.meta.url), "utf8"),
  )) {
    labelled.add(row.address);
  }
}
for (const row of JSON.parse(
  readFileSync(new URL("../data/risk-lists.json", import.meta.url), "utf8"),
).sanctioned) {
  labelled.add(row.address);
}

const seeds = JSON.parse(
  readFileSync(new URL("../data/hot-wallets.json", import.meta.url), "utf8"),
);

/* Layer 1: wallets paying an exchange hot wallet. */
const payers = [];
const seenPayer = new Set();
for (const seed of seeds) {
  if (payers.length >= SAMPLE) break;
  const body = await transfersOf(seed.address, 60);
  for (const row of body?.data ?? []) {
    if (row.to !== seed.address || !row.from) continue;
    if (seenPayer.has(row.from)) continue;
    seenPayer.add(row.from);
    payers.push(row.from);
    if (payers.length >= SAMPLE) break;
  }
  await sleep(PACING_MS);
}

/* Layer 2 — the sample: who funded those, excluding anything we label. */
const sample = [];
const seenSubject = new Set();
for (const payer of payers) {
  if (sample.length >= SAMPLE) break;
  const body = await transfersOf(payer);
  const rows = (body?.data ?? [])
    .map((r) => ({ from: r.from, to: r.to, at: Number(r.block_timestamp) }))
    .filter((r) => Number.isFinite(r.at));
  for (const row of rows) {
    if (row.to !== payer || !row.from) continue;
    if (labelled.has(row.from) || seenSubject.has(row.from)) continue;
    seenSubject.add(row.from);
    sample.push(row.from);
    break; // one subject per payer, so no single payer dominates the sample
  }
  await sleep(PACING_MS);
}

console.log(`Sample: ${sample.length} unlabelled wallets, one hop back from the exchange\n`);

const fires = Object.fromEntries(CODES.map((c) => [c, 0]));
let scored = 0;
let unreadable = 0;
const youngest = [];

for (const address of sample) {
  // Anchor the window to money arriving that still has money moving after it.
  const body = await transfersOf(address);
  const events = (body?.data ?? [])
    .map((r) => ({ to: r.to, at: Number(r.block_timestamp) }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
  const lastOut = events.filter((e) => e.to !== address).at(-1)?.at ?? -1;
  const anchor = events.find((e) => e.to === address && e.at < lastOut);
  await sleep(PACING_MS);
  if (!anchor) continue;

  const fraudDate = new Date(anchor.at).toISOString();
  let trace = null;
  try {
    const res = await fetch(`${BASE}/api/trace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, fraudDate }),
    });
    if (res.ok) trace = await res.json();
  } catch {
    /* one unreadable wallet is not a reason to stop */
  }
  if (!trace?.riskFlags) {
    unreadable++;
    await sleep(PACING_MS);
    continue;
  }

  scored++;
  const codes = new Set(trace.riskFlags.map((f) => f.code));
  for (const code of codes) if (code in fires) fires[code]++;

  const age = trace.nodes
    .filter((n) => n.depth > 0 && n.firstSeen)
    .map((n) => (anchor.at - new Date(n.firstSeen).getTime()) / DAY)
    .filter((a) => a >= 0)
    .sort((a, b) => a - b)[0];
  if (age !== undefined) youngest.push(age);

  console.log(
    `  ${address} ${trace.triage.padEnd(5)} ${[...codes].join(",") || "no flags"}` +
      (age === undefined ? "" : `  youngest intermediary ${age.toFixed(0)}d`),
  );
  await sleep(PACING_MS);
}

console.log(`\nScored ${scored} wallet(s); ${unreadable} could not be read.\n`);
console.log("Base rate per rule — how often it fires on a wallet nobody reported:");
for (const code of CODES) {
  const pct = scored ? ((fires[code] / scored) * 100).toFixed(0) : "0";
  const bar = "#".repeat(Math.round((fires[code] / Math.max(1, scored)) * 30));
  console.log(`  ${code.padEnd(20)} ${String(fires[code]).padStart(3)}/${scored}  ${pct.padStart(3)}%  ${bar}`);
}
if (youngest.length) {
  youngest.sort((a, b) => a - b);
  console.log(
    `\nYoungest intermediary seen: ${youngest[0].toFixed(0)} days ` +
      `(median ${youngest[Math.floor(youngest.length / 2)].toFixed(0)} days across ${youngest.length} traces)`,
  );
} else {
  console.log("\nNo trace produced a readable intermediary, so NEW_ADDRESS had nothing to test.");
}
console.log(
  "\nThis is a base rate, not a false-positive rate: none of these wallets is known to be clean.",
);
