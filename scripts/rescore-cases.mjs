/**
 * Re-run the frozen cases through the live pipeline, keeping the same cases.
 *
 * `freeze-cases.mjs` goes looking for candidates. This does not: it takes the
 * addresses already in `data/demo-cases.json`, re-traces each with the exact
 * request it was captured with, and writes the fresh results back in place.
 *
 * It exists because the recorded cases carry whatever the scoring rules said on
 * the day they were captured. Change a rule and the committed evidence is stale
 * — a case file that disagrees with the code that produced it is the one thing
 * an evidence tool cannot ship. Run this after touching lib/risk.ts.
 *
 * A case whose disposition changes is reported loudly and NOT written: that
 * would mean the pipeline now reads the same wallet differently, which is a
 * finding to look at, not something to quietly commit.
 *
 *   node scripts/rescore-cases.mjs            # against http://localhost:3000
 *   node scripts/rescore-cases.mjs 3010       # another port
 */

import { readFileSync, writeFileSync } from "node:fs";

const PORT = process.argv[2] ?? "3000";
const BASE = `http://localhost:${PORT}`;
const FILE = new URL("../data/demo-cases.json", import.meta.url);
const PACING_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const file = JSON.parse(readFileSync(FILE, "utf8"));
const cases = file.cases ?? [];
console.log(`Re-scoring ${cases.length} frozen case(s) against ${BASE}\n`);

const updated = [];
let changed = 0;
let drifted = 0;
let failed = 0;

for (const entry of cases) {
  const body = JSON.stringify({ address: entry.address, ...entry.request });
  let trace = null;
  try {
    const res = await fetch(`${BASE}/api/trace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) trace = await res.json();
    else console.log(`  ! ${entry.address} — HTTP ${res.status}`);
  } catch (err) {
    console.log(`  ! ${entry.address} — ${err.message}`);
  }

  if (!trace || typeof trace.triage !== "string") {
    failed++;
    updated.push(entry); // keep what we had rather than lose a case
    await sleep(PACING_MS);
    continue;
  }

  const before = (entry.trace.riskFlags ?? []).map((f) => f.code).sort();
  const after = (trace.riskFlags ?? []).map((f) => f.code).sort();
  const sameFlags = before.join() === after.join();

  if (trace.triage !== entry.triage) {
    drifted++;
    console.log(
      `  DRIFT ${entry.address} — was ${entry.triage}, now ${trace.triage}. Kept the old capture.`,
    );
    updated.push(entry);
  } else {
    if (!sameFlags) {
      changed++;
      const added = after.filter((c) => !before.includes(c));
      const gone = before.filter((c) => !after.includes(c));
      console.log(
        `  ${entry.triage.padEnd(5)} ${entry.address}` +
          (added.length ? `  +${added.join(",")}` : "") +
          (gone.length ? `  -${gone.join(",")}` : ""),
      );
    } else {
      console.log(`  ${entry.triage.padEnd(5)} ${entry.address}  unchanged`);
    }
    updated.push({ ...entry, capturedAt: new Date().toISOString(), trace });
  }
  await sleep(PACING_MS);
}

const fired = new Set();
for (const entry of updated) for (const f of entry.trace.riskFlags ?? []) fired.add(f.code);

if (drifted === 0 && failed === 0) {
  writeFileSync(
    FILE,
    `${JSON.stringify({ ...file, capturedAt: new Date().toISOString(), cases: updated }, null, 2)}\n`,
  );
  console.log(`\nWrote ${updated.length} case(s).`);
} else {
  console.log(`\nNOT written — ${drifted} drifted, ${failed} failed. Nothing changed on disk.`);
}

console.log(`Flags changed on ${changed} case(s).`);
console.log(`Rules firing across the set: ${[...fired].sort().join(", ") || "none"} (${fired.size} of 6)`);
console.log("Rebuild before demoing — the file is imported statically.");
