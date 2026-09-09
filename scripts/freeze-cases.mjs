/**
 * Freeze three real cases for demo mode. AGENTS.md §10.
 *
 * Run this with the dev server up:
 *
 *     node scripts/freeze-cases.mjs
 *
 * It finds real TRON addresses that should resolve to each disposition, runs
 * them through **our own live pipeline** (`POST /api/trace`, the same endpoint
 * the interface uses), and writes whatever came back into
 * `data/demo-cases.json`. Nothing is invented: each stored case is a complete
 * TraceResult with the SHA-256 of every chain response it was built from, so
 * any claim in it can be checked afterwards.
 *
 * Finding the candidates is the same trick the whole project rests on, run
 * backwards. We already hold 165 addresses that sweep into exchange hot wallets
 * and 202 addresses from the OFAC list; anyone who *sent* to one of those has,
 * by construction, a trail that ends there. So:
 *
 *   WARM — someone who paid into a known customer deposit address
 *   COLD — someone who paid into a sanctioned address
 *   HOT  — someone whose money is sitting at an address with no way out
 *
 * The disposition is never assumed. Each candidate is traced and the result is
 * only kept if the pipeline independently reached the disposition we wanted.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(ROOT, "data", "demo-cases.json");

const BASE = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const API = process.env.FINEX_API ?? "http://localhost:3000";

/**
 * The public endpoint throttles a burst hard, and a throttled call is
 * indistinguishable from an address with no history — which silently scored
 * every candidate at zero on the first attempt at this. `scripts/cluster.mjs`
 * already found the workable pacing: a long gap plus a real backoff on 429.
 */
const GAP_MS = 1200;
const RETRY_MS = [1500, 4000, 9000];
let lastCall = 0;
let throttled = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chain(address) {
  const url =
    `${BASE}/v1/accounts/${address}/transactions/trc20` +
    `?limit=200&only_confirmed=true&contract_address=${USDT}`;

  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    const gap = GAP_MS - (Date.now() - lastCall);
    if (gap > 0) await sleep(gap);
    lastCall = Date.now();
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = RETRY_MS[attempt];
        if (wait === undefined) {
          throttled++;
          return null;
        }
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      const body = await res.json();
      const rows = Array.isArray(body?.data) ? body.data : [];
      return rows
        .filter((r) => /^\d+$/.test(String(r?.value ?? "")))
        .map((r) => ({
          from: r.from,
          to: r.to,
          value: Number(BigInt(r.value)) / 1e6,
          at: Number(r.block_timestamp) || 0,
        }));
    } catch {
      const wait = RETRY_MS[attempt];
      if (wait === undefined) {
        throttled++;
        return null;
      }
      await sleep(wait);
    }
  }
  throttled++;
  return null;
}

const readJson = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

/** Deterministic shuffle, so a rerun looks at the same seeds in the same order. */
function ordered(list, seed = 7) {
  return [...list]
    .map((v, i) => [v, Math.sin(i * seed) * 10000 % 1])
    .sort((a, b) => a[1] - b[1])
    .map(([v]) => v);
}

/**
 * People who paid into `target`, each scored by how much of their outgoing
 * money that payment was.
 *
 * The score matters more than it looks. `decide()` picks the terminal by taint,
 * so a payer who also shipped a larger sum elsewhere resolves to *that* instead,
 * and the deposit address — the whole point of the product — ends up a
 * footnote. Nothing is filtered out here; the caller sorts by share and traces
 * the best ones, which is more forgiving than a hard threshold on a chain where
 * most people move money in several directions.
 */
async function payersInto(target, { min = 50, take = 3 } = {}) {
  const transfers = await chain(target);
  if (!transfers) return [];
  const inbound = transfers
    .filter((t) => t.to === target && t.from !== target && t.value >= min)
    // Most recent first: the fewer outflows that follow, the cleaner the case.
    .sort((a, b) => b.at - a.at)
    .slice(0, take);

  const out = [];
  for (const t of inbound) {
    const fraudAt = t.at - 60_000;
    const theirs = await chain(t.from);
    if (!theirs) continue;
    const window = theirs.filter((x) => x.from === t.from && x.at > fraudAt);
    const total = window.reduce((s, x) => s + x.value, 0);
    if (total <= 0) continue;
    const share = t.value / total;
    if (share < 0.12) continue;
    out.push({
      address: t.from,
      amount: Math.round(t.value * 100) / 100,
      fraudDate: new Date(fraudAt).toISOString(),
      share,
      why:
        `paid ${t.value.toFixed(2)} USDT into ${target} — ` +
        `${Math.round(share * 100)}% of everything they sent after that date`,
    });
  }
  return out;
}

/**
 * An address that received USDT and has never sent any: money with no way out.
 *
 * Scanned from the *recipients* of ordinary wallets. An earlier version scanned
 * the payers instead, which cannot work — a payer has sent money by definition,
 * so nothing it looked at could ever be at rest.
 */
async function fundsAtRest(seeds, limit = 30) {
  const seen = new Set();
  let checked = 0;
  for (const seed of seeds) {
    const transfers = await chain(seed);
    if (!transfers) continue;
    const recipients = transfers
      .filter((t) => t.from === seed && t.to !== seed)
      .sort((a, b) => b.value - a.value)
      .map((t) => t.to);
    for (const addr of recipients) {
      if (seen.has(addr) || checked >= limit) continue;
      seen.add(addr);
      checked++;
      const theirs = await chain(addr);
      if (!theirs) continue;
      const inbound = theirs.filter((x) => x.to === addr);
      if (theirs.some((x) => x.from === addr) || inbound.length === 0) continue;
      const total = inbound.reduce((s, x) => s + x.value, 0);
      if (total < 20) continue;
      const first = Math.min(...inbound.map((x) => x.at));
      return [
        {
          address: addr,
          amount: Math.round(total * 100) / 100,
          fraudDate: new Date(first - 60_000).toISOString(),
          share: 1,
          why: `received ${total.toFixed(2)} USDT across ${inbound.length} transfer(s) and has never sent any`,
        },
      ];
    }
    if (checked >= limit) break;
  }
  return [];
}

/** Which sanctioned addresses have any USDT inflow at all to work back from. */
async function sanctionedWithUsdt(addresses, want = 3) {
  const hits = [];
  for (const addr of addresses) {
    const transfers = await chain(addr);
    if (transfers?.some((t) => t.to === addr)) hits.push(addr);
    if (hits.length >= want) break;
  }
  return hits;
}

async function runTrace(candidate) {
  const res = await fetch(`${API}/api/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: candidate.address,
      amount: candidate.amount,
      fraudDate: candidate.fraudDate,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

/**
 * Trace every candidate and keep all that reached the wanted disposition,
 * richest first.
 *
 * The first pass stopped at the first match, which is why the register ended up
 * with a two-wallet WARM case: the first address to resolve is rarely the most
 * instructive one. A trace with more wallets on it shows the method better, so
 * candidates are ranked by how much trail they actually produced.
 */
async function capture(level, candidates, want = 2) {
  const hits = [];
  for (const c of candidates.slice(0, 5)) {
    process.stdout.write(`  ${level}: ${c.address} … `);
    try {
      const trace = await runTrace(c);
      const rich = `${trace.nodes.length}w/${trace.edges.length}e`;
      console.log(`${trace.triage} ${rich}`);
      if (trace.triage === level) hits.push({ candidate: c, trace });
    } catch (err) {
      console.log(`failed — ${err.message.slice(0, 60)}`);
    }
    if (hits.length >= want + 1) break;
  }
  return hits
    .sort((a, b) => b.trace.nodes.length - a.trace.nodes.length)
    .slice(0, want);
}

/**
 * Levels to capture on this run, e.g. `node scripts/freeze-cases.mjs HOT`.
 * A level not named here keeps whatever is already frozen, so a good case is
 * never lost to a rerun that happened to find a worse one.
 */
const WANTED = (() => {
  const args = process.argv.slice(2).map((a) => a.toUpperCase());
  const levels = args.filter((a) => ["HOT", "WARM", "COLD"].includes(a));
  return levels.length ? new Set(levels) : new Set(["WARM", "COLD", "HOT"]);
})();

async function main() {
  console.log(`Capturing: ${[...WANTED].join(", ")}
`);
  const deposits = readJson("data/deposit-addresses.json");
  const sanctioned = readJson("data/risk-lists.json").sanctioned ?? [];

  console.log("Finding candidates from the committed data …");

  const warmSeeds = ordered(deposits).slice(0, 20).map((d) => d.address);
  const coldSeeds = ordered(sanctioned, 11).slice(0, 60).map((s) => s.address);

  const byShare = (a, b) => b.share - a.share;

  const warmCandidates = [];
  const payerPool = [];
  for (const seed of WANTED.has("WARM") || WANTED.has("HOT") ? warmSeeds : []) {
    const found = await payersInto(seed, { min: 50, take: 3 });
    warmCandidates.push(...found);
    payerPool.push(...found.map((c) => c.address));
    if (warmCandidates.length >= 8) break;
  }
  warmCandidates.sort(byShare);

  // Most OFAC TRON entries hold TRX rather than USDT, so find the few with any
  // USDT inflow before spending calls working backwards from them.
  const liveSanctioned = WANTED.has("COLD") ? await sanctionedWithUsdt(coldSeeds, 3) : [];
  console.log(`  sanctioned addresses with USDT inflow: ${liveSanctioned.length}`);
  const coldCandidates = [];
  for (const seed of liveSanctioned) {
    coldCandidates.push(...(await payersInto(seed, { min: 10, take: 3 })));
    if (coldCandidates.length >= 6) break;
  }
  coldCandidates.sort(byShare);

  // Ordinary wallets make the best starting point for finding money at rest.
  const hotCandidates = WANTED.has("HOT") ? await fundsAtRest(payerPool.slice(0, 10)) : [];

  // Report refusals. A throttled read and an address with no history are the
  // same empty list, and not saying so cost two runs that found nothing.
  console.log(
    `  candidates — WARM ${warmCandidates.length}, COLD ${coldCandidates.length}, HOT ${hotCandidates.length}` +
      (throttled
        ? `  (${throttled} chain call(s) gave up after retries — the endpoint is throttling)`
        : ""),
  );

  console.log("Running them through the live pipeline (this is slow on purpose) …");

  const found = [];
  for (const [level, candidates] of [
    ["WARM", warmCandidates],
    ["COLD", coldCandidates],
    ["HOT", hotCandidates],
  ].filter(([level]) => WANTED.has(level))) {
    const hits = await capture(level, candidates);
    if (hits.length) hits.forEach((h) => found.push({ level, ...h }));
    else console.log(`  ${level}: no candidate resolved to ${level}`);
  }

  // A level this run could not find keeps whatever was frozen before, so a bad
  // network day never empties the safety net.
  const existing = (() => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8")).cases ?? [];
    } catch {
      return [];
    }
  })();
  const foundAddresses = new Set(found.map((f) => f.candidate.address));
  const kept = existing.filter((c) => !foundAddresses.has(c.address));
  if (kept.length) {
    console.log(`
  keeping ${kept.length} previously frozen case(s): ${kept.map((c) => c.triage).join(", ")}`);
  }

  if (found.length === 0 && kept.length === 0) {
    console.error("\nNothing was captured. The file is left untouched.");
    process.exitCode = 1;
    return;
  }

  const now = new Date().toISOString();
  const out = {
    _note_:
      "Frozen traces, captured from the live pipeline against real TRON addresses. " +
      "AGENTS.md §10. Each entry is a complete TraceResult exactly as /api/trace " +
      "returned it, including the response hashes it was built from, so any claim " +
      "in it can be re-verified. Regenerate with `node scripts/freeze-cases.mjs` " +
      "while the dev server is running, then rebuild — this file is imported " +
      "statically so demo mode needs no filesystem and no network.",
    capturedAt: now,
    cases: [
      ...kept,
      ...found.map((f) => ({
        address: f.candidate.address,
        capturedAt: now,
        triage: f.trace.triage,
        /** Why this address was chosen. Kept so the selection is auditable. */
        selectedBecause: f.candidate.why,
        request: {
          amount: f.candidate.amount,
          fraudDate: f.candidate.fraudDate,
        },
        trace: f.trace,
      })),
    ],
  };

  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${found.length} case(s) to data/demo-cases.json:`);
  for (const c of out.cases) {
    console.log(`  ${String(c.triage).padEnd(5)} ${c.address}  ${c.trace.caseId}`);
  }
  console.log("\nRebuild before demoing — the file is imported statically.");
}

main();
