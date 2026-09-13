/**
 * Look for an Indian exchange in the public USDT holder tags.
 *
 * AGENTS.md §6 asks for at least one Indian VASP among the clustering seeds,
 * and says why: Western tools under-label Indian exchanges, so naming one is
 * the strongest thing this project can say to an MHA audience. The first pass
 * checked the top 500 holders, found none, and CONTEXT.md records that with the
 * standing instruction — do not invent one.
 *
 * This goes deeper: every tagged holder the explorer will serve, which is
 * 10,000 accounts rather than 500. It writes down every distinct tag it sees,
 * not only the matches, so "no Indian exchange appears" becomes a statement
 * backed by a list rather than an absence of effort.
 *
 * If it finds nothing, that is the finding. The instruction not to invent one
 * stands either way.
 *
 *   node scripts/hunt-indian-vasp.mjs [maxHolders]
 */

import { writeFileSync } from "node:fs";

const MAX = Number(process.argv[2] ?? 10000);
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const PAGE = 200;
const PACING_MS = 700;
const OUT = new URL("../data/vasp-scan.json", import.meta.url);

/* Indian VASPs worth having, and common spellings of each. */
const WANTED = [
  "coindcx",
  "wazirx",
  "mudrex",
  "zebpay",
  "bitbns",
  "giottus",
  "coinswitch",
  "unocoin",
  "buyucoin",
  "krypto",
  "sunbit",
  "pocketbits",
  "colodax",
  "flitpay",
  "throughbit",
  "instashift",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tags = new Map(); // tag -> { count, example }
const hits = [];
let scanned = 0;

for (let start = 0; start < MAX; start += PAGE) {
  let body = null;
  for (let attempt = 0; attempt < 3 && !body; attempt++) {
    try {
      const res = await fetch(
        `https://apilist.tronscan.org/api/token_trc20/holders` +
          `?sort=-balance&limit=${PAGE}&start=${start}&contract_address=${USDT}`,
      );
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) break;
      body = await res.json();
    } catch {
      await sleep(1500);
    }
  }
  const rows = body?.trc20_tokens ?? [];
  if (!rows.length) break;

  for (const row of rows) {
    scanned++;
    const tag = (row.addressTag ?? "").trim();
    if (!tag) continue;
    const seen = tags.get(tag) ?? { count: 0, example: row.holder_address };
    seen.count++;
    tags.set(tag, seen);

    const lower = tag.toLowerCase().replace(/[\s._-]/g, "");
    const match = WANTED.find((name) => lower.includes(name));
    if (match) {
      hits.push({
        exchange: tag,
        matched: match,
        address: row.holder_address,
        balanceUsdt: Math.round(Number(row.balance ?? 0) / 1e6),
        source_url: `https://tronscan.org/#/address/${row.holder_address}`,
      });
      console.log(`  HIT  ${tag}  ${row.holder_address}`);
    }
  }
  if (start % 1000 === 0) {
    console.log(`  … ${scanned} holders scanned, ${tags.size} distinct tags, ${hits.length} hit(s)`);
  }
  await sleep(PACING_MS);
}

const tagList = [...tags.entries()]
  .map(([tag, v]) => ({ tag, wallets: v.count, example: v.example }))
  .sort((a, b) => b.wallets - a.wallets);

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      _note_:
        "Every distinct address tag Tronscan serves across the top USDT holders, " +
        "and any that matches a known Indian VASP. Evidence for the claim in " +
        "CONTEXT.md that no Indian exchange is publicly tagged at this depth.",
      scannedAt: new Date().toISOString(),
      holdersScanned: scanned,
      distinctTags: tagList.length,
      indianVaspHits: hits,
      tags: tagList,
    },
    null,
    2,
  )}\n`,
);

console.log(`\nScanned ${scanned} holders, ${tagList.length} distinct tags.`);
console.log(`Indian VASP hits: ${hits.length}`);
if (!hits.length) {
  console.log("\nNo Indian exchange is publicly tagged at this depth.");
  console.log("That is the finding. Do not invent one — see CONTEXT.md.");
}
console.log("\nTop tags seen:");
for (const t of tagList.slice(0, 25)) {
  console.log(`  ${String(t.wallets).padStart(3)}  ${t.tag}`);
}
console.log("\nWritten to data/vasp-scan.json");
