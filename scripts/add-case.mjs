/**
 * Freeze one named wallet into the recorded case file.
 *
 * `freeze-cases.mjs` hunts for candidates by disposition. This takes an address
 * you already have a reason to want and captures it with the same convention:
 * the fraud date is anchored to a real transfer into the wallet that still has
 * money moving after it, never a date chosen to make a rule fire.
 *
 * Written to close a specific gap — no frozen case exercised NEW_ADDRESS, so
 * the rule was implemented, guarded, and never observed on real chain data. A
 * rule nobody has watched fire is a rule we cannot stand behind in a room.
 *
 *   node scripts/add-case.mjs TLCmqm7a5sneMhsjRC2Pd6j4zd4zPh5K6S "why this one"
 */

import { readFileSync, writeFileSync } from "node:fs";

const ADDRESS = process.argv[2];
const WHY = process.argv[3] ?? "";
const PORT = process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;
const GRID = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FILE = new URL("../data/demo-cases.json", import.meta.url);

if (!ADDRESS) {
  console.error("usage: node scripts/add-case.mjs <address> [reason]");
  process.exit(1);
}

const res = await fetch(
  `${GRID}/v1/accounts/${ADDRESS}/transactions/trc20?limit=200&only_confirmed=true&contract_address=${USDT}`,
);
if (!res.ok) {
  console.error(`chain read failed: HTTP ${res.status}`);
  process.exit(1);
}
const rows = (await res.json()).data ?? [];
const events = rows
  .map((r) => ({ to: r.to, at: Number(r.block_timestamp) }))
  .filter((e) => Number.isFinite(e.at))
  .sort((a, b) => a.at - b.at);
const lastOut = events.filter((e) => e.to !== ADDRESS).at(-1)?.at ?? -1;
const anchor = events.find((e) => e.to === ADDRESS && e.at < lastOut);

if (!anchor) {
  console.error("no inflow with outflows after it — nothing to anchor the window to");
  process.exit(1);
}

const fraudDate = new Date(anchor.at).toISOString();
console.log(`Tracing ${ADDRESS} from ${fraudDate} …`);

const traceRes = await fetch(`${BASE}/api/trace`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: ADDRESS, fraudDate }),
});
if (!traceRes.ok) {
  console.error(`trace failed: HTTP ${traceRes.status}`);
  process.exit(1);
}
const trace = await traceRes.json();

const file = JSON.parse(readFileSync(FILE, "utf8"));
if (file.cases.some((c) => c.address === ADDRESS)) {
  console.error("already frozen — nothing written");
  process.exit(1);
}

file.cases.push({
  address: ADDRESS,
  capturedAt: new Date().toISOString(),
  triage: trace.triage,
  selectedBecause: WHY,
  request: { amount: trace.reportedAmountUsdt, fraudDate },
  trace,
});
file.capturedAt = new Date().toISOString();
writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`);

const codes = trace.riskFlags.map((f) => f.code);
console.log(`  ${trace.triage}  ${trace.caseId}  ${codes.join(",") || "no flags"}`);
console.log(`\n${file.cases.length} case(s) now frozen. Rebuild before demoing.`);
