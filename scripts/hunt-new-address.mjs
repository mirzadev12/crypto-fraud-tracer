/**
 * Find a real case that exercises NEW_ADDRESS.
 *
 * The rule fires when a wallet the money passed through first appeared on chain
 * inside the 30 days before the reported fraud — a wallet opened for the job.
 * None of the nine frozen cases triggers it, and a rule nobody has ever seen
 * fire is a rule we cannot stand behind.
 *
 * The honest way to find one is the same convention `freeze-cases.mjs` uses:
 * the fraud date is anchored to a real transfer into the subject wallet, never
 * chosen to make a rule light up. We then simply look at what the pipeline says
 * about that case. If no candidate triggers it, that is the answer and it gets
 * reported as one.
 *
 *   node scripts/hunt-new-address.mjs [port] [attempts]
 */

import { readFileSync, writeFileSync } from "node:fs";

const PORT = process.argv[2] ?? "3000";
const ATTEMPTS = Number(process.argv[3] ?? 40);
const BASE = `http://localhost:${PORT}`;
const OUT = new URL("../data/new-address-candidates.json", import.meta.url);
const GRID = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const PACING_MS = 1400;
const DAY = 86_400_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grid(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GRID}${path}`);
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
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

/**
 * Candidates: wallets that recently paid into a tagged exchange wallet. They
 * are real, they are active, and their own counterparties are the kind of
 * short-lived wallet the rule is written for.
 */
const seeds = JSON.parse(
  readFileSync(new URL("../data/hot-wallets.json", import.meta.url), "utf8"),
);

const pool = [];
const seen = new Set();
for (const seed of seeds) {
  if (pool.length >= ATTEMPTS * 2) break;
  const body = await grid(
    `/v1/accounts/${seed.address}/transactions/trc20?limit=60&only_confirmed=true&contract_address=${USDT}`,
  );
  const rows = Array.isArray(body?.data) ? body.data : [];
  for (const row of rows) {
    if (row.to !== seed.address) continue;
    if (!row.from || seen.has(row.from)) continue;
    seen.add(row.from);
    pool.push(row.from);
    if (pool.length >= ATTEMPTS * 2) break;
  }
  await sleep(PACING_MS);
}

/*
 * Anchor the fraud date to money ARRIVING, not money leaving.
 *
 * The first version of this dated each case from the candidate's payment into
 * the exchange — the last thing it ever did — so the trace opened its window
 * after all the money was already gone. Thirty wallets came back with no
 * outflows and no flags, which is a broken hunt, not an absent pattern. The
 * window has to open when the victim's money landed: an inflow that still has
 * money moving after it.
 */
const candidates = [];
for (const address of pool) {
  if (candidates.length >= ATTEMPTS) break;
  const body = await grid(
    `/v1/accounts/${address}/transactions/trc20?limit=200&only_confirmed=true&contract_address=${USDT}`,
  );
  const rows = Array.isArray(body?.data) ? body.data : [];
  const events = rows
    .map((r) => ({ to: r.to, at: Number(r.block_timestamp) }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
  const lastOut = events.filter((e) => e.to !== address).at(-1)?.at ?? -1;
  const anchor = events.find((e) => e.to === address && e.at < lastOut);
  if (anchor) candidates.push({ address, at: anchor.at });
  await sleep(PACING_MS);
}

console.log(`${candidates.length} candidate wallet(s) to try\n`);

const hits = [];
let tried = 0;
for (const candidate of candidates) {
  tried++;
  // The fraud date is anchored to a real transfer, never chosen to suit a rule.
  const fraudDate = new Date(candidate.at).toISOString();
  let trace = null;
  try {
    const res = await fetch(`${BASE}/api/trace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: candidate.address, fraudDate }),
    });
    if (res.ok) trace = await res.json();
  } catch {
    /* keep going — one unreadable wallet is not a reason to stop */
  }
  if (!trace?.riskFlags) {
    await sleep(PACING_MS);
    continue;
  }

  const codes = trace.riskFlags.map((f) => f.code);
  const youngest = trace.nodes
    .filter((n) => n.depth > 0 && n.firstSeen)
    .map((n) => (new Date(fraudDate) - new Date(n.firstSeen)) / DAY)
    .filter((age) => age >= 0)
    .sort((a, b) => a - b)[0];

  const line =
    `${String(tried).padStart(3)}/${candidates.length} ${candidate.address} ` +
    `${trace.triage.padEnd(5)} ${codes.join(",") || "no flags"}` +
    (youngest === undefined ? "" : `  youngest downstream ${youngest.toFixed(0)}d`);

  if (codes.includes("NEW_ADDRESS")) {
    console.log(`${line}   <-- HIT`);
    hits.push({ address: candidate.address, fraudDate, triage: trace.triage, trace });
  } else {
    console.log(line);
  }
  await sleep(PACING_MS);
}

if (hits.length) {
  writeFileSync(OUT, `${JSON.stringify({ huntedAt: new Date().toISOString(), hits }, null, 2)}\n`);
  console.log(`\n${hits.length} case(s) triggered NEW_ADDRESS -> data/new-address-candidates.json`);
} else {
  // Nothing found is a result, not a file to commit.
  console.log(`\nNo candidate triggered NEW_ADDRESS across ${tried} traced wallet(s).`);
  console.log("The rule needs a wallet first seen inside the 30 days before the reported");
  console.log("fraud; these cases all moved through wallets that were already established.");
}
