/**
 * Deposit-address clustering on Ethereum. The TRON script's idea, with two
 * things Ethereum adds and one thing it demands.
 *
 *   node scripts/cluster-eth.mjs [--senders 30] [--ratio 0.90] [--sweeps 2]
 *                                [--pages 6] [--window 8000] [--from 0]
 *                                [--wallets N] [--merge]
 *
 * Runs offline, on a laptop, with no key. Output is committed; nothing here
 * runs in production.
 *
 * Two routes to a customer deposit address:
 *
 *  - **Sweep route** — the TRON rule: an address that forwarded at least 90% of
 *    what it received, in at least two sweeps, to the exchange's tagged wallets.
 *    Counted against all of that exchange's wallets, not one: exchanges rotate
 *    wallets, and a deposit address that swept to the old one and then the new
 *    one is one deposit address, not two failed matches.
 *  - **Funder route** — Ethereum only. An exchange pays the gas for its customer
 *    deposit addresses to move tokens, from a wallet explorers tag as its
 *    "Deposit Funder". An address funded from there that then sends 90% or more
 *    of its USDT to one wallet is a deposit address at that exchange, on two
 *    independent signals. This is what attributes WazirX, whose consolidation
 *    wallet carries no public tag at all. A wallet that five or more of these
 *    addresses sweep into is recorded as a derived exchange wallet, so a trace
 *    that reaches it stops there.
 *
 * What Ethereum demands: address poisoning. Look-alike addresses send dust and
 * spoof zero-value transfers into exchange wallets, and on 24 Sep the only
 * "deposit address" the unfiltered rule found on one Bybit wallet was a
 * look-alike that had sent 4 and 6 USDT. So nothing under 1 USDT counts, for
 * inflow, sweeps or senders.
 *
 * Reads: Blockscout REST v2 (no key, 180 a minute); for a seed so large that
 * Blockscout times out, a public node's `eth_getLogs` over the recent window
 * (it refuses older ranges without a key). Every row says what it rests on.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { toChecksumAddress } from "../lib/evm.ts";

/* ------------------------------------------------------------------- flags */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
const SENDER_CAP = flag("senders", 30); // AGENTS.md §7: do not remove the cap
const MIN_RATIO = flag("ratio", 0.9);
const MIN_SWEEPS = flag("sweeps", 2);
const MAX_PAGES = flag("pages", 6);
const WINDOW = flag("window", 8000);
const FROM = flag("from", 0);
const WALLET_LIMIT = flag("wallets", Infinity);
const MERGE = argv.includes("--merge");
const MIN_USDT = 1; // poisoning dust and zero-value spoofs never count
const MIN_SHARED = 5; // funded deposit addresses sweeping to one wallet before it is recorded

const SEEDS_ALL = JSON.parse(readFileSync("data/eth/hot-wallets.json", "utf8"));
const SEEDS = SEEDS_ALL.slice(FROM, FROM + WALLET_LIMIT);
const OUT = "data/eth/deposit-addresses.json";
const OUT_WALLETS = "data/eth/consolidation-wallets.json";

const BS = "https://eth.blockscout.com/api/v2";
const RPC = "https://ethereum-rpc.publicnode.com";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lc = (a) => String(a).toLowerCase();
const cs = (a) => toChecksumAddress(a);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/* ------------------------------------------------------------------ fetching */

let calls = 0;
let throttled = 0;
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
      // Retried like a throttle: one slow answer used to read as "no inflows"
      // and send a seed to the node's recent window, which silently yielded
      // zero rows for CoinSwitch's 2021 wallet on 25 Sep.
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status !== 524)) {
      throttled++;
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return { error: res.status };
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (remaining <= 2 && reset > 0) nextAt = Date.now() + Math.min(reset, 61_000);
    try {
      return await res.json();
    } catch {
      return { error: "json" };
    }
  }
  return { error: 429 };
}

async function rpc(method, params) {
  calls++;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
    const js = await res.json();
    return js.error ? null : js.result;
  } catch {
    return null;
  }
}

const cursor = (p) =>
  p ? "&" + new URLSearchParams(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))) : "";

/** A wallet's USDT history, newest first: [{from, to, value, contract}], and whether it is whole. */
async function usdtHistory(address, pages = MAX_PAGES, filter = "") {
  const rows = [];
  let next = null;
  for (let page = 0; page < pages; page++) {
    const js = await bs(
      `/addresses/${address}/token-transfers?type=ERC-20&token=${USDT}${filter ? `&filter=${filter}` : ""}${cursor(next)}`,
    );
    if (!js || js.error || !Array.isArray(js.items)) return { rows, whole: false, error: js?.error ?? "no body" };
    for (const t of js.items) {
      const value = Number(BigInt(t.total?.value ?? "0")) / 1e6;
      if (!(value >= MIN_USDT)) continue;
      rows.push({
        from: lc(t.from.hash),
        to: lc(t.to.hash),
        value,
        fromContract: t.from.is_contract === true && t.from.proxy_type !== "eip7702",
      });
    }
    next = js.next_page_params;
    if (!next || js.items.length < 50) return { rows, whole: true };
  }
  return { rows, whole: false };
}

/** Recent USDT inflows to a very large wallet, from a node, when Blockscout cannot page it. */
async function recentInflowsFromNode(address) {
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  if (!Number.isFinite(head)) return [];
  const topic = "0x" + lc(address).slice(2).padStart(64, "0");
  const rows = [];
  for (let from = head - WINDOW; from <= head; from += 500) {
    const logs = await rpc("eth_getLogs", [
      { address: USDT, topics: [TRANSFER_TOPIC, null, topic], fromBlock: "0x" + from.toString(16), toBlock: "0x" + Math.min(head, from + 499).toString(16) },
    ]);
    if (!logs) continue;
    for (const l of logs) {
      const value = Number(BigInt(l.data)) / 1e6;
      if (value >= MIN_USDT) rows.push({ from: "0x" + l.topics[1].slice(26), to: lc(address), value });
    }
    await sleep(120);
  }
  return rows;
}

/** Addresses a deposit funder paid gas to, newest first. */
async function fundedBy(funder) {
  const out = [];
  let next = null;
  for (let page = 0; page < 6 && out.length < SENDER_CAP * 2; page++) {
    const js = await bs(`/addresses/${funder}/transactions?filter=from${cursor(next)}`);
    if (!js || js.error || !Array.isArray(js.items)) break;
    for (const t of js.items) {
      const to = t.to?.hash;
      if (!to || t.to.is_contract === true || !(Number(t.value) > 0)) continue;
      if (!out.includes(lc(to))) out.push(lc(to));
    }
    next = js.next_page_params;
    if (!next) break;
  }
  return out;
}

/* --------------------------------------------------------------------- run */

const found = new Map();

/**
 * Record a deposit address. Found by both routes — gas-funded by the exchange
 * AND sweeping to its tagged wallet — it is one address on two independent
 * signals, and the row says so instead of the second route overwriting the
 * first.
 */
function record(key, row) {
  const prior = found.get(key);
  if (!prior || prior.route === row.route) {
    found.set(key, row);
    return;
  }
  const funder = prior.route === "funder" ? prior : row;
  const sweep = prior.route === "sweep" ? prior : row;
  const sweeps = Math.max(funder.sweepCount, sweep.sweepCount);
  found.set(key, {
    ...funder,
    route: "both",
    sweepCount: sweeps,
    confidence: Math.min(0.5 + sweeps * 0.03, 0.95),
    evidence: `${funder.evidence}; also ${sweep.evidence}`,
    windowTruncated: funder.windowTruncated || sweep.windowTruncated,
  });
}
const derived = new Map();
if (MERGE) {
  try {
    for (const row of JSON.parse(readFileSync(OUT, "utf8"))) found.set(lc(row.address), row);
    for (const row of JSON.parse(readFileSync(OUT_WALLETS, "utf8"))) derived.set(lc(row.address), row);
    console.log(`  merging into ${found.size} existing row(s)`);
  } catch {
    console.log("  nothing to merge into — starting fresh");
  }
}

/** Every tagged wallet of each exchange, lower case — the sweep route counts all of them. */
const walletsOf = new Map();
for (const s of SEEDS_ALL) {
  if (s.role === "deposit_funder") continue;
  const set = walletsOf.get(s.exchange) ?? new Set();
  set.add(lc(s.address));
  walletsOf.set(s.exchange, set);
}
const seedSet = new Set(SEEDS_ALL.map((s) => lc(s.address)));
const perSeed = [];
const startedAt = Date.now();

console.log(
  `clustering ${SEEDS.length} Ethereum seeds · cap ${SENDER_CAP} · ratio ≥ ${MIN_RATIO} · sweeps ≥ ${MIN_SWEEPS} (sweep route) · ≥ ${MIN_USDT} USDT per transfer\n`,
);

for (const [i, seed] of SEEDS.entries()) {
  const label = `[${i + 1}/${SEEDS.length}] ${seed.tag}`;
  let hits = 0;
  let examined = 0;
  let via = "";

  if (seed.role === "deposit_funder") {
    const recipients = (await fundedBy(seed.address)).filter((a) => !seedSet.has(a));
    for (const addr of recipients) {
      if (examined >= SENDER_CAP) break;
      const { rows, whole } = await usdtHistory(addr);
      if (!rows.length) continue; // funded for another token
      examined++;
      const totalIn = rows.filter((t) => t.to === addr).reduce((s, t) => s + t.value, 0);
      const byDest = new Map();
      for (const t of rows) {
        if (t.from !== addr) continue;
        const d = byDest.get(t.to) ?? { value: 0, sweeps: 0 };
        d.value += t.value;
        d.sweeps++;
        byDest.set(t.to, d);
      }
      const [dest, d] = [...byDest].sort((a, b) => b[1].value - a[1].value)[0] ?? [];
      if (!dest || totalIn <= 0) continue;
      const ratio = d.value / totalIn;
      if (d.sweeps < 1 || ratio < MIN_RATIO) continue;
      const truncated = !whole || ratio > 1.0001;
      const pct = Math.min(100, Math.round(ratio * 100));
      record(addr, {
        address: cs(addr),
        exchange: seed.exchange,
        route: "funder",
        sweepCount: d.sweeps,
        confidence: Math.min(0.5 + d.sweeps * 0.03, 0.95),
        evidence:
          `Gas-funded by "${seed.tag}"; ${d.sweeps} sweep${d.sweeps === 1 ? "" : "s"}, ${pct}% of inflow to ${short(cs(dest))}` +
          (truncated ? ` (first ${MAX_PAGES * 50} transfers examined)` : ""),
        sweptTo: cs(dest),
        windowTruncated: truncated,
        seed: seed.address,
      });
      hits++;
    }
    via = "funded addresses";
  } else {
    const exchangeWallets = walletsOf.get(seed.exchange) ?? new Set([lc(seed.address)]);
    const read = await usdtHistory(seed.address, MAX_PAGES, "to");
    let inflows = read.rows.filter((t) => t.to === lc(seed.address));
    via = "senders (explorer)";
    // A failed read is not an empty wallet: say so, rather than let the
    // fallback below look like the answer.
    if (read.error && inflows.length === 0) console.log(`  ${seed.tag}: explorer read failed (${read.error}) — trying the node's recent window`);
    if (inflows.length === 0) {
      inflows = await recentInflowsFromNode(seed.address);
      via = `senders (node, last ${WINDOW} blocks)`;
    }
    const senders = [...new Set(inflows.map((t) => t.from))]
      .filter((a) => !seedSet.has(a))
      .slice(0, SENDER_CAP);
    for (const sender of senders) {
      const { rows, whole } = await usdtHistory(sender);
      if (!rows.length) continue;
      examined++;
      let totalIn = 0;
      let toExchange = 0;
      let sweeps = 0;
      for (const t of rows) {
        if (t.to === sender) totalIn += t.value;
        if (t.from === sender && exchangeWallets.has(t.to)) {
          toExchange += t.value;
          sweeps++;
        }
      }
      if (totalIn <= 0) continue;
      const ratio = toExchange / totalIn;
      if (sweeps < MIN_SWEEPS || ratio < MIN_RATIO) continue;
      const truncated = !whole || ratio > 1.0001;
      const pct = Math.min(100, Math.round(ratio * 100));
      record(sender, {
        address: cs(sender),
        exchange: seed.exchange,
        route: "sweep",
        sweepCount: sweeps,
        confidence: Math.min(0.5 + sweeps * 0.03, 0.95),
        evidence:
          `${sweeps} sweeps, ${pct}% of inflow forwarded to ${seed.exchange}'s tagged wallets ("${seed.tag}")` +
          (truncated ? ` (first ${MAX_PAGES * 50} transfers examined)` : ""),
        sweptTo: cs(seed.address),
        windowTruncated: truncated,
        seed: seed.address,
      });
      hits++;
    }
  }

  perSeed.push({ tag: seed.tag, exchange: seed.exchange, examined, hits });
  console.log(`${label} — ${examined} ${via} examined, ${hits} deposit addresses (running total ${found.size}, ${calls} calls)`);

  // Derived consolidation wallets: where the funder-route addresses of one
  // exchange converge, when it is not already a tagged seed.
  const counts = new Map();
  for (const row of found.values()) {
    if (row.route === "sweep") continue;
    const key = `${row.exchange}|${lc(row.sweptTo)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, k] of counts) {
    const [exchange, wallet] = key.split("|");
    if (k < MIN_SHARED || seedSet.has(wallet)) continue;
    const funder = SEEDS_ALL.find((s) => s.exchange === exchange && s.role === "deposit_funder");
    derived.set(wallet, {
      address: cs(wallet),
      exchange,
      confidence: Math.min(0.5 + k * 0.03, 0.95),
      evidence: `Common sweep target of ${k} addresses gas-funded by "${funder?.tag ?? exchange}"`,
      sharedBy: k,
    });
  }

  writeFileSync(OUT, JSON.stringify([...found.values()], null, 2) + "\n");
  writeFileSync(OUT_WALLETS, JSON.stringify([...derived.values()], null, 2) + "\n");
}

/* ---------------------------------------------------------------- summary */

const rows = [...found.values()];
const exchanges = new Set(rows.map((r) => r.exchange));
console.log(
  `\n──────────────────────────────────────────────────────────────\n` +
    `  ${rows.length} Ethereum deposit addresses across ${exchanges.size} exchanges\n` +
    `  from ${SEEDS_ALL.length} tagged seeds, public data only, no key\n` +
    `  ${derived.size} derived exchange wallet(s)\n` +
    `──────────────────────────────────────────────────────────────\n` +
    `  ${calls} calls · ${throttled} throttled · ${((Date.now() - startedAt) / 60000).toFixed(1)} min\n` +
    `  per seed (zeros included):\n` +
    perSeed.map((p) => `    ${String(p.hits).padStart(3)} of ${String(p.examined).padStart(2)}  ${p.tag}`).join("\n") +
    `\n  written to ${OUT} and ${OUT_WALLETS}\n`,
);
