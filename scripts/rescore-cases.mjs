/**
 * Re-run the frozen cases through the live pipeline, keeping the same cases.
 *
 * `freeze-cases.mjs` goes looking for candidates. This does not: it takes the
 * addresses already in `data/demo-cases.json`, re-traces each with the exact
 * request it was captured with, and writes the fresh results back in place.
 *
 * Each case is re-traced **as of the moment it was captured** — its own
 * `provenance.generatedAt` — through the tracer's `asOf`. Confirmed transfers
 * never change, so the chain as it stood then can be read again today, and
 * only what the code does with it can differ. Re-tracing against the chain as
 * it stands now would fold in everything the wallets did since capture, and a
 * rule change would be indistinguishable from a wallet that moved.
 *
 * It exists because the recorded cases carry whatever the scoring rules said on
 * the day they were captured. Change a rule and the committed evidence is stale
 * — a case file that disagrees with the code that produced it is the one thing
 * an evidence tool cannot ship. Run this after touching lib/risk.ts.
 *
 * A case whose disposition changes is reported loudly and nothing is written:
 * that would mean the pipeline now reads the same wallet differently, which is
 * a finding to look at, not something to quietly commit.
 *
 * A case whose re-read came back worse — a wallet that was read at capture and
 * could not be read now, which on the public endpoint means it was throttled —
 * keeps its old capture and is listed for another try with `--only`. A
 * throttled read is not a different answer, it is a missing one, and replacing
 * a complete case with it would put "no outgoing transfers" on a wallet nobody
 * looked at.
 *
 *   node scripts/rescore-cases.mjs                  # against http://localhost:3000
 *   node scripts/rescore-cases.mjs 3010             # another port
 *   node scripts/rescore-cases.mjs 3010 --only T…   # just the named case(s)
 *
 * The server must not be in demo mode: an as-of request for a case's own
 * capture moment is exactly the run the frozen file holds, so a demo-mode
 * server would answer it from the file and nothing would be re-derived. The
 * script checks `/api/health` and refuses rather than report a no-op as a pass.
 */

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
const ONLY = onlyAt >= 0 ? new Set(args.slice(onlyAt + 1)) : null;
const PORT = (onlyAt === 0 ? undefined : args[0]) ?? "3000";
const BASE = `http://localhost:${PORT}`;
const FILE = new URL("../data/demo-cases.json", import.meta.url);
const PACING_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  if (health.demoMode) {
    console.log(`${BASE} is in demo mode — it would answer every case from the file being re-scored. Start it without DEMO_MODE.`);
    process.exit(1);
  }
} catch (err) {
  console.log(`Could not reach ${BASE}/api/health (${err.message}). Is the server running?`);
  process.exit(1);
}

const file = JSON.parse(readFileSync(FILE, "utf8"));
const cases = file.cases ?? [];
console.log(`Re-scoring ${cases.length} frozen case(s) against ${BASE}\n`);

const updated = [];
let attempted = 0;
let changed = 0;
let drifted = 0;
let failed = 0;
const retry = [];

for (const entry of cases) {
  if (ONLY && !ONLY.has(entry.address)) {
    updated.push(entry);
    continue;
  }
  attempted++;
  const asOf = entry.trace?.provenance?.generatedAt;
  const body = JSON.stringify({ address: entry.address, ...entry.request, ...(asOf ? { asOf } : {}) });
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
    retry.push(entry.address);
    updated.push(entry); // keep what we had rather than lose a case
    await sleep(PACING_MS);
    continue;
  }

  // A wallet the money reached that returned no history at all was not read.
  // If the old capture did read it, this re-read is worse, not different.
  const readBefore = new Set(
    (entry.trace.nodes ?? []).filter((n) => n.firstSeen !== null).map((n) => n.address),
  );
  const unreadNow = (trace.nodes ?? [])
    .filter((n) => n.depth > 0 && !n.label && n.firstSeen === null)
    .map((n) => n.address);
  const lost = unreadNow.filter((a) => readBefore.has(a));
  if (lost.length) {
    failed++;
    retry.push(entry.address);
    console.log(
      `  THROTTLED ${entry.address} — ${lost.length} wallet(s) read at capture could not be read now. Kept the old capture.`,
    );
    updated.push(entry);
    await sleep(PACING_MS);
    continue;
  }
  if (unreadNow.length) {
    console.log(`  note: ${entry.address} has ${unreadNow.length} unread wallet(s), as its capture did.`);
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
    // `capturedAt` stays the moment the chain was read: an as-of re-score reads
    // the same chain, so the case is no newer than it was.
    updated.push({ ...entry, trace });
  }
  await sleep(PACING_MS);
}

const fired = new Set();
for (const entry of updated) for (const f of entry.trace.riskFlags ?? []) fired.add(f.code);

if (drifted === 0) {
  writeFileSync(FILE, `${JSON.stringify({ ...file, cases: updated }, null, 2)}\n`);
  console.log(`\nWrote ${updated.length} case(s); re-derived ${attempted - failed} of the ${attempted} attempted.`);
  if (retry.length) {
    console.log(`Kept the old capture for ${retry.length}. Try again with:`);
    console.log(`  node scripts/rescore-cases.mjs ${PORT} --only ${retry.join(" ")}`);
  }
} else {
  console.log(`\nNOT written — ${drifted} drifted. Nothing changed on disk.`);
}

console.log(`Flags changed on ${changed} case(s).`);
console.log(`Rules firing across the set: ${[...fired].sort().join(", ") || "none"} (${fired.size} of 6)`);
console.log("Rebuild before demoing — the file is imported statically.");
