/**
 * Deposit-address clustering. AGENTS.md §7.
 *
 *   node scripts/cluster.mjs [--senders 30] [--ratio 0.90] [--sweeps 2]
 *                            [--delay 350] [--wallets 11] [--pages 2]
 *
 * Runs offline, once, on a laptop. The output is committed to the repo and is
 * never generated in production.
 *
 * The idea, in one sentence: exchanges give every customer a unique deposit
 * address and later sweep it into a main hot wallet, so an address that
 * receives from many unrelated sources and forwards almost all of it to one
 * known exchange hot wallet, repeatedly, is very likely a customer deposit
 * address at that exchange.
 *
 * That is a heuristic and the output says so — every row carries the sweep
 * count and the forwarded percentage it was derived from, and `lib/labels.ts`
 * must tag these `heuristic`, never `ground_truth`.
 *
 * Deliberately standalone: no imports from lib/, its own fetch, so it can be
 * run and tuned without the app building.
 */

import { readFileSync, writeFileSync } from "node:fs";

/* ------------------------------------------------------------------- flags */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};

const SENDER_CAP = flag("senders", 30); // §7: DO NOT REMOVE THE CAP
const MIN_RATIO = flag("ratio", 0.9);
const MIN_SWEEPS = flag("sweeps", 2);
const DELAY_MS = flag("delay", 1200);
const WALLET_LIMIT = flag("wallets", Infinity);
const MAX_PAGES = flag("pages", 2);
/*
 * Which slice of the seed list to run, and whether to keep what is already on
 * disk. The script rewrites its output file, so adding a seed used to mean
 * re-deriving every earlier one — fifteen minutes against a rate-limited public
 * endpoint, with a throttled run quietly returning FEWER rows than the file it
 * replaced. `--from N --merge` runs the new seeds only and adds to the existing
 * set instead of standing in for it.
 */
const FROM = flag("from", 0);
const MERGE = argv.includes("--merge");

const HOT_WALLETS = JSON.parse(readFileSync("data/hot-wallets.json", "utf8")).slice(
  FROM,
  FROM + WALLET_LIMIT,
);

const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const BASE = "https://api.trongrid.io";
const OUT = "data/deposit-addresses.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ fetching */

let apiCalls = 0;
let throttled = 0;

/**
 * TronGrid throttles unauthenticated pagination quickly, so every request is
 * paced and a 429 backs off rather than burning the run.
 */
async function pages(address) {
  const out = [];
  let truncated = false;
  let url =
    `${BASE}/v1/accounts/${address}/transactions/trc20` +
    `?limit=200&only_confirmed=true&contract_address=${USDT}`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    let body = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep(DELAY_MS);
      apiCalls++;
      try {
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (res.status === 429 || res.status >= 500) {
          throttled++;
          await sleep(4000 * (attempt + 1));
          continue;
        }
        if (!res.ok) return { rows: out, truncated };
        body = await res.json();
        break;
      } catch {
        await sleep(4000 * (attempt + 1));
      }
    }
    if (!body || !Array.isArray(body.data)) return { rows: out, truncated };

    for (const row of body.data) {
      if (!row || typeof row.from !== "string" || typeof row.to !== "string") continue;
      const raw = String(row.value ?? "");
      if (!/^\d+$/.test(raw)) continue;
      // Zero-value transfers are address-poisoning spoofs that move nothing; a
      // spoofed "sweep" must not count towards a deposit address. (Added 25 Sep
      // 2026; the committed rows were derived before it — see
      // docs/features/05-zero-value-guard.md.)
      if (/^0+$/.test(raw)) continue;
      const decimals = row.token_info?.decimals ?? 6;
      out.push({
        from: row.from,
        to: row.to,
        value: Number(BigInt(raw)) / 10 ** decimals,
      });
    }

    const next = body.meta?.links?.next;
    if (!next || body.data.length < 200) return { rows: out, truncated };
    url = next;
    // More pages exist than we are willing to pull for one address.
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { rows: out, truncated };
}

/* ------------------------------------------------------------------- run */

const found = new Map(); // address -> row, so a sender seen twice is not doubled

// Seed the map from disk when merging, so the checkpoint writes below never
// stand in for rows this run was not asked to re-derive.
if (MERGE) {
  try {
    for (const row of JSON.parse(readFileSync(OUT, "utf8"))) found.set(row.address, row);
    console.log(`  merging into ${found.size} existing row(s)`);
  } catch {
    console.log("  nothing to merge into — starting fresh");
  }
}
const startedAt = Date.now();

console.log(
  `clustering ${HOT_WALLETS.length} hot wallets · cap ${SENDER_CAP} senders · ` +
    `ratio ≥ ${MIN_RATIO} · sweeps ≥ ${MIN_SWEEPS}\n`,
);

for (const [i, wallet] of HOT_WALLETS.entries()) {
  const label = `[${i + 1}/${HOT_WALLETS.length}] ${wallet.tag}`;
  let inflows = (await pages(wallet.address)).rows;
  if (inflows.length === 0) {
    await sleep(8000);
    inflows = (await pages(wallet.address)).rows;
  }

  // Distinct senders into this hot wallet, capped. The cap is what keeps the
  // run bounded; removing it turns a ten-minute job into an overnight one.
  const senders = [
    ...new Set(inflows.filter((t) => t.to === wallet.address).map((t) => t.from)),
  ]
    .filter((a) => a !== wallet.address)
    .slice(0, SENDER_CAP);

  let hits = 0;
  for (const sender of senders) {
    const { rows: txs, truncated } = await pages(sender);
    let totalIn = 0;
    let toHot = 0;
    let sweeps = 0;
    for (const t of txs) {
      if (t.to === sender) totalIn += t.value;
      if (t.from === sender && t.to === wallet.address) {
        toHot += t.value;
        sweeps++;
      }
    }
    if (totalIn <= 0) continue;
    const ratio = toHot / totalIn;
    if (sweeps < MIN_SWEEPS || ratio < MIN_RATIO) continue;

    const pct = Math.min(100, Math.round(ratio * 100));
    found.set(sender, {
      address: sender,
      exchange: wallet.exchange,
      sweepCount: sweeps,
      confidence: Math.min(0.5 + sweeps * 0.03, 0.95),
      // Says exactly what was observed, including the limits of the window —
      // a high-volume address is only sampled, and the packet must not imply
      // otherwise.
      evidence:
        `${sweeps} sweeps, ${pct}% of inflow forwarded to ${wallet.tag}` +
        (truncated ? ` (first ${MAX_PAGES * 200} transfers examined)` : ""),
      windowTruncated: truncated,
      hotWallet: wallet.address,
    });
    hits++;
  }

  console.log(
    `${label} — ${senders.length} senders examined, ${hits} deposit addresses ` +
      `(running total ${found.size}, ${apiCalls} api calls)`,
  );
  // Checkpoint after every wallet: a throttle stall must not lose the run.
  writeFileSync(OUT, JSON.stringify([...found.values()], null, 2) + "\n");
}

/* ---------------------------------------------------------------- summary */

const rows = [...found.values()];
const exchanges = new Set(rows.map((r) => r.exchange));
const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);

writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");

console.log(
  `\n──────────────────────────────────────────────────────────────\n` +
    `  ${rows.length} deposit addresses across ${exchanges.size} exchanges\n` +
    `  from ${HOT_WALLETS.length} seed wallets, public data only\n` +
    `──────────────────────────────────────────────────────────────\n` +
    `  ${apiCalls} api calls · ${throttled} throttled · ${minutes} min\n` +
    `  exchanges: ${[...exchanges].join(", ")}\n` +
    `  written to ${OUT}\n`,
);

if (rows.length === 0) {
  console.log("  Nothing matched. §7 says: drop --ratio to 0.80 and --sweeps to 1.\n");
} else if (rows.length > 5000) {
  console.log("  Too many. §7 says: raise --ratio to 0.95 and --sweeps to 3.\n");
}
