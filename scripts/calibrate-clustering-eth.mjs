/**
 * Does an Ethereum deposit-address attribution still hold when it is read again?
 *
 *   node scripts/calibrate-clustering-eth.mjs
 *
 * The Ethereum counterpart of `calibrate-clustering.mjs`, and the same
 * question: every row in `data/eth/deposit-addresses.json` carries a
 * confidence from `0.5 + sweeps × 0.03`, and a confidence figure is only worth
 * printing if it has been checked. So every row — the whole set, not a sample:
 * Blockscout answers 180 requests a minute without a key, which reads 193
 * addresses in a few minutes — is re-read from the chain today and re-tested
 * with the rule that found it:
 *
 *  - **sweep route** (found among the senders into a tagged exchange wallet):
 *    still forwards at least 90% of its USDT to that exchange's tagged wallets,
 *    in at least two sweeps;
 *  - **funder route** (gas-funded by the exchange's tagged deposit funder):
 *    still forwards at least 90% of its USDT to the wallet it was found
 *    sweeping to, at least once. The gas funding is a past transaction and
 *    cannot change; the sweep is what can stop;
 *  - **both**: holds if either does.
 *
 * Same limits as the TRON measurement, stated where the result is shown: this
 * tests whether the pattern *persists* on transfers the derivation never saw,
 * not who owns the address — only the exchange can confirm that — and an
 * address the chain would not answer for is excluded from every rate, never
 * counted as a failure. Transfers under 1 USDT never count, exactly as in the
 * derivation (address-poisoning dust). Persistence also means little when the
 * re-read comes soon after the derivation: the rows that swept again since are
 * the ones actually tested, and the output counts them.
 *
 * **A second, independent test: who paid the gas.** An Ethereum deposit
 * address cannot move its USDT without ETH for gas, and exchanges send that ETH
 * from their own wallets. For every row found by the sweep rule alone, the
 * senders of ETH into the address are read with the explorer's tags on them:
 *
 *  - **agrees** — a sender is tagged as the same exchange: a second behaviour,
 *    independent of the sweeps, points at the same exchange (a wallet that
 *    merely settles to an exchange sends it money, but does not get its gas
 *    from it);
 *  - **conflicts** — no sender is, but one is tagged as another entity's gas,
 *    fee, funder or custody wallet: someone else manages this address, which is
 *    the method's known failure (a custodied or merchant wallet that settles to
 *    one exchange looks like a customer deposit address);
 *  - **no signal** — no tagged sender either way (a customer withdrawing ETH
 *    from another exchange's hot wallet is neither).
 *
 * Rows found through the exchange's gas wallet are left out of this test: they
 * were found by it, so it cannot confirm them.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROWS = "data/eth/deposit-addresses.json";
const SEEDS = "data/eth/hot-wallets.json";
const OUT = "data/eth/clustering-calibration.json";

/* The derivation's own thresholds (scripts/cluster-eth.mjs), kept identical on
   purpose: if they drift apart, this stops describing the method. */
const MIN_RATIO = 0.9;
const MIN_SWEEPS = { sweep: 2, funder: 1 };
const MAX_PAGES = 6;
const MIN_USDT = 1;

const BS = "https://eth.blockscout.com/api/v2";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lc = (a) => String(a).toLowerCase();

let calls = 0;
let nextAt = 0;

async function bs(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = Math.max(0, nextAt - Date.now());
    if (wait) await sleep(wait);
    nextAt = Date.now() + 360;
    calls++;
    let res;
    try {
      res = await fetch(BS + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    } catch {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (remaining <= 2 && reset > 0) nextAt = Date.now() + Math.min(reset, 61_000);
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

const cursor = (p) =>
  p ? "&" + new URLSearchParams(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))) : "";

/** The newest MAX_PAGES pages of USDT history, as the derivation read it; null when unreadable. */
async function history(address) {
  const rows = [];
  let next = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const js = await bs(`/addresses/${address}/token-transfers?type=ERC-20&token=${USDT}${cursor(next)}`);
    if (!js || !Array.isArray(js.items)) return page === 0 ? null : { rows, whole: false };
    for (const t of js.items) {
      const value = Number(BigInt(t.total?.value ?? "0")) / 1e6;
      if (!(value >= MIN_USDT)) continue;
      rows.push({ from: lc(t.from.hash), to: lc(t.to.hash), value });
    }
    next = js.next_page_params;
    if (!next || js.items.length < 50) return { rows, whole: true };
  }
  return { rows, whole: false };
}

/** Sweeps and forwarded share from `address` to any wallet in `targets`. */
function measure(rows, address, targets) {
  let totalIn = 0;
  let forwarded = 0;
  let sweeps = 0;
  for (const t of rows) {
    if (t.to === address) totalIn += t.value;
    if (t.from === address && targets.has(t.to)) {
      forwarded += t.value;
      sweeps++;
    }
  }
  return { sweeps, ratio: totalIn > 0 ? forwarded / totalIn : 0, totalIn };
}

const bandOf = (c) => (c >= 0.9 ? "0.90–0.95" : c >= 0.75 ? "0.75–0.89" : c >= 0.6 ? "0.60–0.74" : "0.50–0.59");

const rows = JSON.parse(readFileSync(ROWS, "utf8"));
let derivedAt = null;
try {
  derivedAt = new Date(
    execFileSync("git", ["log", "-1", "--format=%cI", "--", ROWS], { encoding: "utf8" }).trim(),
  ).toISOString();
} catch {
  // not a checkout, or git missing: the gap is then not stated
}
const walletsOf = new Map();
for (const s of JSON.parse(readFileSync(SEEDS, "utf8"))) {
  if (s.role === "deposit_funder") continue;
  walletsOf.set(s.exchange, (walletsOf.get(s.exchange) ?? new Set()).add(lc(s.address)));
}

console.log(`Re-reading all ${rows.length} derived Ethereum deposit addresses from the chain.\n`);
const startedAt = Date.now();
const results = [];
for (const [i, row] of rows.entries()) {
  const address = lc(row.address);
  process.stdout.write(`  [${i + 1}/${rows.length}] ${row.address.slice(0, 10)}… ${row.route.padEnd(6)} `);
  const read = await history(address);
  const base = { address: row.address, exchange: row.exchange, route: row.route, confidence: row.confidence, band: bandOf(row.confidence) };
  if (!read) {
    console.log("unreadable — excluded");
    results.push({ ...base, readable: false });
    continue;
  }
  const sweep = measure(read.rows, address, walletsOf.get(row.exchange) ?? new Set());
  const funder = measure(read.rows, address, new Set([lc(row.sweptTo)]));
  const holdsSweep = sweep.sweeps >= MIN_SWEEPS.sweep && sweep.ratio >= MIN_RATIO;
  const holdsFunder = funder.sweeps >= MIN_SWEEPS.funder && funder.ratio >= MIN_RATIO;
  const stillHolds = row.route === "sweep" ? holdsSweep : row.route === "funder" ? holdsFunder : holdsSweep || holdsFunder;
  const now = row.route === "sweep" ? sweep : row.route === "funder" ? funder : sweep.sweeps >= funder.sweeps ? sweep : funder;
  const reason = stillHolds
    ? ""
    : now.totalIn <= 0
      ? "no inflow of 1 USDT or more in the transfers read"
      : now.sweeps < (row.route === "sweep" ? MIN_SWEEPS.sweep : MIN_SWEEPS.funder)
        ? "too few sweeps"
        : "forwards less than 90%";
  console.log(stillHolds ? `holds (${now.sweeps} sweeps, ${Math.round(now.ratio * 100)}%)` : `does not hold — ${reason} (${now.sweeps} sweeps, ${Math.round(now.ratio * 100)}%)`);
  results.push({
    ...base,
    readable: true,
    stillHolds,
    ...(reason ? { reason } : {}),
    sweepsNow: now.sweeps,
    ratioNow: Number(now.ratio.toFixed(4)),
    sweepsAtDerivation: row.sweepCount,
    /** More sweeps than the derivation saw: the pattern continued on transfers it never read. */
    continued: now.sweeps > row.sweepCount,
    /** More history than the newest MAX_PAGES pages; the test covers those, as the derivation did. */
    windowTruncated: !read.whole,
  });
}

/* --------------------------------------------------- who paid the gas */

const ALIAS = {
  Binance: /binance/i,
  Coinbase: /coinbase/i,
  MEXC: /mexc|\bmxc\b/i,
  "Gate.io": /\bgate\b|gate\.io/i,
  Bitfinex: /bitfinex/i,
  Bitget: /bitget/i,
  CoinDCX: /coindcx/i,
  WazirX: /wazirx/i,
};
const MANAGER = /gas|fee provider|funder|custody/i;
const tagsOf = (who) =>
  [who?.name, ...(who?.metadata?.tags ?? []).map((t) => t.name), ...(who?.public_tags ?? []).map((t) => t.label)]
    .filter(Boolean)
    .join(" / ");

/** Tagged senders of ETH into an address, from its first 100 incoming transactions; null when unreadable. */
async function gasPayers(address) {
  const payers = new Map();
  let next = null;
  for (let page = 0; page < 2; page++) {
    const js = await bs(`/addresses/${address}/transactions?filter=to${cursor(next)}`);
    if (!js || !Array.isArray(js.items)) return page === 0 ? null : payers;
    for (const t of js.items) {
      if (!(Number(t.value) > 0) || lc(t.to?.hash) !== address) continue;
      const tags = tagsOf(t.from);
      if (tags) payers.set(lc(t.from.hash), tags);
    }
    next = js.next_page_params;
    if (!next) break;
  }
  return payers;
}

const sweepOnly = rows.filter((r) => r.route === "sweep");
console.log(`\nWho paid the gas: ${sweepOnly.length} addresses found by the sweep rule alone.\n`);
const gas = [];
for (const [i, row] of sweepOnly.entries()) {
  process.stdout.write(`  [${i + 1}/${sweepOnly.length}] ${row.address.slice(0, 10)}… ${row.exchange.padEnd(9)} `);
  const payers = await gasPayers(lc(row.address));
  if (!payers) {
    console.log("unreadable — excluded");
    gas.push({ address: row.address, exchange: row.exchange, readable: false });
    continue;
  }
  const same = [...payers].find(([, tags]) => ALIAS[row.exchange]?.test(tags));
  const other = same ? null : [...payers].find(([, tags]) => MANAGER.test(tags));
  const verdict = same ? "agrees" : other ? "conflicts" : "no-signal";
  const [payer, tags] = same ?? other ?? [];
  console.log(verdict + (tags ? ` — ${tags}` : ""));
  gas.push({ address: row.address, exchange: row.exchange, readable: true, verdict, ...(payer ? { payer, tags } : {}) });
}

const readable = results.filter((r) => r.readable);
const tally = (list) => ({
  measured: list.length,
  held: list.filter((r) => r.stillHolds).length,
  continued: list.filter((r) => r.continued).length,
  rate: list.length ? Number((list.filter((r) => r.stillHolds).length / list.length).toFixed(4)) : null,
});
const bands = [...new Set(results.map((r) => r.band))].sort();

const out = {
  _method:
    "Every derived Ethereum deposit address, re-read from the public chain and re-tested with the rule that found it: sweep route, >=2 sweeps forwarding >=90% of USDT inflow to the exchange's tagged wallets; funder route, >=1 sweep forwarding >=90% to the wallet it was found sweeping to (its gas funding is a past transaction); both routes, either. Transfers under 1 USDT never count. Measures whether the pattern persists on transfers the derivation never saw. It does NOT establish ownership: only the exchange can confirm whose account an address is.",
  _unreadable:
    "Addresses the chain would not answer for are recorded and excluded from every rate. A throttled read is not a failed address.",
  generatedAt: new Date().toISOString(),
  /** When the rows were derived: the commit that last wrote them. The gap to generatedAt is how long the pattern had to fail. */
  derivedAt,
  predicate: { minSweeps: MIN_SWEEPS.sweep, minRatio: MIN_RATIO, minSweepsFunded: MIN_SWEEPS.funder },
  population: rows.length,
  sampled: results.length,
  readable: readable.length,
  unreadable: results.length - readable.length,
  held: readable.filter((r) => r.stillHolds).length,
  continued: readable.filter((r) => r.continued).length,
  overallRate: tally(readable).rate,
  perBand: bands.map((band) => ({ band, ...tally(readable.filter((r) => r.band === band)) })),
  perRoute: ["sweep", "funder", "both"].map((route) => ({ route, ...tally(readable.filter((r) => r.route === route)) })),
  perExchange: [...new Set(rows.map((r) => r.exchange))].map((exchange) => ({ exchange, ...tally(readable.filter((r) => r.exchange === exchange)) })),
  gasPayer: {
    _method:
      "For each address found by the sweep rule alone, the senders of ETH into it (first 100 incoming transactions), with the explorer's tags. agrees: a sender is tagged as the same exchange. conflicts: none is, but one is tagged as another entity's gas, fee, funder or custody wallet. no-signal: neither. Rows found through the exchange's gas wallet are excluded: that wallet found them.",
    tested: gas.length,
    readable: gas.filter((g) => g.readable).length,
    agrees: gas.filter((g) => g.verdict === "agrees").length,
    conflicts: gas.filter((g) => g.verdict === "conflicts").length,
    noSignal: gas.filter((g) => g.verdict === "no-signal").length,
    perExchange: [...new Set(sweepOnly.map((r) => r.exchange))].map((exchange) => {
      const list = gas.filter((g) => g.exchange === exchange && g.readable);
      return {
        exchange,
        tested: list.length,
        agrees: list.filter((g) => g.verdict === "agrees").length,
        conflicts: list.filter((g) => g.verdict === "conflicts").length,
      };
    }),
    conflicting: gas.filter((g) => g.verdict === "conflicts"),
    results: gas,
  },
  calls,
  results,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

console.log(`\n${"—".repeat(60)}`);
console.log(`Readable ${readable.length}/${results.length} · still holds ${out.held} · continued ${out.continued} · ${calls} calls · ${((Date.now() - startedAt) / 60000).toFixed(1)} min`);
for (const b of out.perBand) console.log(`  band  ${b.band}: ${b.held}/${b.measured}`);
for (const r of out.perRoute) console.log(`  route ${r.route}: ${r.held}/${r.measured}`);
for (const e of out.perExchange) console.log(`  ${e.exchange}: ${e.held}/${e.measured}`);
const g = out.gasPayer;
console.log(`Gas payer: ${g.agrees} agree · ${g.conflicts} conflict · ${g.noSignal} no signal (of ${g.readable} readable)`);
for (const e of g.perExchange) console.log(`  ${e.exchange}: ${e.agrees} agree, ${e.conflicts} conflict, of ${e.tested}`);
for (const c of g.conflicting) console.log(`  conflict: ${c.address} (${c.exchange}) — ${c.tags}`);
console.log(`\nWritten to ${OUT}`);
