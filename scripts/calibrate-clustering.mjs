/**
 * Does the confidence figure on a derived deposit address mean anything?
 *
 *   node scripts/calibrate-clustering.mjs [--sample 24] [--key <TRONGRID_API_KEY>]
 *
 * Every row in `data/deposit-addresses.json` carries a confidence, and until
 * now that number came from one line in `scripts/cluster.mjs`:
 *
 *     confidence: Math.min(0.5 + sweeps * 0.03, 0.95)
 *
 * That formula was written into a planning document and never checked. It is an
 * assertion, not a measurement — nobody had established that a row scoring 0.95
 * is right more often than one scoring 0.56, which is the only thing a
 * confidence figure is for. A forecaster who says "70% chance of rain" is only
 * useful if it rains on about seventy percent of the days they say it.
 *
 * So this measures it. For a stratified sample of rows it re-reads the address
 * from the chain today and asks whether the sweep pattern the clustering found
 * still holds: does it still forward almost everything it receives to the same
 * exchange hot wallet, repeatedly.
 *
 * WHAT THIS IS NOT. It does not establish ownership — only the exchange can do
 * that, and the attribution page says so. Both the derivation and this check
 * read the same public endpoint, so this is a test of whether the pattern
 * *persists*, not of whether the label is true. What it can catch is the
 * failure mode the method actually has: a merchant that settles to one exchange
 * looks identical to a customer deposit address at derivation time, and is far
 * less likely to still look identical months later on transfers the clustering
 * never saw.
 *
 * Two rules carried from the rest of the pipeline:
 *
 *   - An address the chain would not answer for is recorded as unreadable and
 *     excluded from the denominator. Counting a throttled read as a failed
 *     address would understate the method, which is the same class of lie as
 *     counting it as a success.
 *   - Nothing is rounded away. The output states the sample size beside every
 *     rate, because a rate over six addresses is not a rate over sixty.
 */

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const OUT = "data/clustering-calibration.json";

/* The predicate the clustering itself used — kept identical on purpose. If
   these drift apart the measurement stops describing the method. */
const MIN_RATIO = 0.9;
const MIN_SWEEPS = 2;

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SAMPLE = Number(flag("sample", 24));
const KEY = flag("key", process.env.TRONGRID_API_KEY ?? "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function transfers(address) {
  const out = [];
  let url =
    `${BASE}/v1/accounts/${address}/transactions/trc20` +
    `?limit=200&only_confirmed=true&contract_address=${USDT}`;
  for (let page = 0; page < 3 && url; page++) {
    let body = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json", ...(KEY ? { "TRON-PRO-API-KEY": KEY } : {}) },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status === 429 || res.status >= 500) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        if (!res.ok) return null;
        body = await res.json();
        break;
      } catch {
        await sleep(1200 * (attempt + 1));
      }
    }
    // Could not read it. Null is "unknown", never "empty" — the caller excludes
    // it rather than scoring it.
    if (!body) return null;
    for (const row of body.data ?? []) {
      const raw = String(row.value ?? "");
      if (!/^\d+$/.test(raw)) continue;
      // Zero-value transfers are address-poisoning spoofs that move nothing; a
      // spoofed "sweep" must not count towards a deposit address. (Added 25 Sep
      // 2026; the committed rows were derived before it — see
      // docs/features/05-zero-value-guard.md.)
      if (/^0+$/.test(raw)) continue;
      out.push({
        from: row.from,
        to: row.to,
        value: Number(BigInt(raw)) / 1e6,
        at: row.block_timestamp ?? 0,
      });
    }
    const next = body.meta?.links?.next;
    if (!next || (body.data ?? []).length < 200) break;
    url = next;
    await sleep(260);
  }
  return out;
}

/** The clustering's own test, re-applied to whatever the chain says today. */
function holds(rows, address, hotWallet) {
  let totalIn = 0;
  let toHot = 0;
  let sweeps = 0;
  let latestSweepAt = 0;
  for (const t of rows) {
    if (t.to === address) totalIn += t.value;
    if (t.from === address && t.to === hotWallet) {
      toHot += t.value;
      sweeps += 1;
      if (t.at > latestSweepAt) latestSweepAt = t.at;
    }
  }
  if (totalIn <= 0) return { ok: false, reason: "no inflow observed", sweeps, ratio: 0, latestSweepAt };
  const ratio = toHot / totalIn;
  return {
    ok: sweeps >= MIN_SWEEPS && ratio >= MIN_RATIO,
    reason: sweeps < MIN_SWEEPS ? "too few sweeps" : ratio < MIN_RATIO ? "forwards less than 90%" : "",
    sweeps,
    ratio,
    latestSweepAt,
  };
}

/** Confidence rounds to a handful of values; group them so bands have numbers in them. */
const bandOf = (c) => (c >= 0.9 ? "0.90–0.95" : c >= 0.75 ? "0.75–0.89" : c >= 0.6 ? "0.60–0.74" : "0.50–0.59");

/**
 * Stratified, deterministic sample: take an even slice from each band rather
 * than a random draw, so a re-run measures the same rows and the figure can be
 * compared with the last one. 140 of the 241 rows sit at 0.95, and a uniform
 * random sample would be almost entirely that band and say nothing about the
 * rest.
 */
function pick(rows, n) {
  const byBand = new Map();
  for (const r of rows) {
    const b = bandOf(r.confidence);
    byBand.set(b, [...(byBand.get(b) ?? []), r]);
  }
  const bands = [...byBand.keys()].sort();
  const per = Math.max(1, Math.floor(n / bands.length));
  const out = [];
  for (const b of bands) {
    const list = [...byBand.get(b)].sort((x, y) => x.address.localeCompare(y.address));
    const step = Math.max(1, Math.floor(list.length / per));
    for (let i = 0; i < list.length && out.filter((r) => bandOf(r.confidence) === b).length < per; i += step) {
      out.push(list[i]);
    }
  }
  return out;
}

const rows = JSON.parse(readFileSync("data/deposit-addresses.json", "utf8"));
const sample = pick(rows, SAMPLE);

console.log(`Re-reading ${sample.length} of ${rows.length} derived addresses from the chain.`);
console.log(`Test: still sweeps >= ${MIN_SWEEPS} times and forwards >= ${MIN_RATIO * 100}% to its recorded hot wallet.\n`);

const results = [];
for (const [i, row] of sample.entries()) {
  process.stdout.write(`  [${i + 1}/${sample.length}] ${row.address.slice(0, 10)}… `);
  const rowsNow = await transfers(row.address);
  if (rowsNow === null) {
    console.log("unreadable — excluded");
    results.push({ address: row.address, confidence: row.confidence, band: bandOf(row.confidence), readable: false });
    continue;
  }
  const v = holds(rowsNow, row.address, row.hotWallet);
  console.log(
    v.ok
      ? `holds (${v.sweeps} sweeps, ${(v.ratio * 100).toFixed(0)}%)`
      : `does not hold — ${v.reason} (${v.sweeps} sweeps, ${(v.ratio * 100).toFixed(0)}%)`,
  );
  results.push({
    address: row.address,
    exchange: row.exchange,
    confidence: row.confidence,
    band: bandOf(row.confidence),
    readable: true,
    stillHolds: v.ok,
    sweepsNow: v.sweeps,
    ratioNow: Number(v.ratio.toFixed(4)),
    sweepsAtDerivation: row.sweepCount,
    /** More sweeps than the derivation saw means the pattern continued on
        transfers the clustering never read — the strongest signal here. */
    continued: v.sweeps > row.sweepCount,
  });
  await sleep(260);
}

const readable = results.filter((r) => r.readable);
const bands = [...new Set(results.map((r) => r.band))].sort();
const perBand = bands.map((band) => {
  const inBand = readable.filter((r) => r.band === band);
  const held = inBand.filter((r) => r.stillHolds).length;
  return {
    band,
    measured: inBand.length,
    held,
    continued: inBand.filter((r) => r.continued).length,
    rate: inBand.length ? Number((held / inBand.length).toFixed(4)) : null,
  };
});

const out = {
  _method:
    "A stratified sample of derived deposit addresses, re-read from the public chain and re-tested with the clustering's own predicate (>=2 sweeps, >=90% of inflow forwarded to the recorded hot wallet). Measures whether the pattern persists on transfers the derivation never saw. It does NOT establish ownership: both the derivation and this check read the same public endpoint, and only the exchange can confirm whose account an address is.",
  _unreadable:
    "Addresses the chain would not answer for are recorded and excluded from every rate. A throttled read is not a failed address.",
  generatedAt: new Date().toISOString(),
  predicate: { minSweeps: MIN_SWEEPS, minRatio: MIN_RATIO },
  population: rows.length,
  sampled: results.length,
  readable: readable.length,
  unreadable: results.length - readable.length,
  held: readable.filter((r) => r.stillHolds).length,
  continued: readable.filter((r) => r.continued).length,
  overallRate: readable.length
    ? Number((readable.filter((r) => r.stillHolds).length / readable.length).toFixed(4))
    : null,
  perBand,
  results,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

console.log(`\n${"—".repeat(60)}`);
console.log(`Readable: ${readable.length}/${results.length}  ·  still holds: ${out.held}  ·  pattern continued: ${out.continued}`);
for (const b of perBand) {
  console.log(`  ${b.band}: ${b.held}/${b.measured} hold${b.rate !== null ? ` (${(b.rate * 100).toFixed(0)}%)` : ""}`);
}
console.log(`\nWritten to ${OUT}`);
