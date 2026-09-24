/**
 * Refresh the sanctions tables from the OFAC SDN list.
 *
 *   node scripts/refresh-sanctions.mjs                     # read sdn.xml from treasury.gov
 *   node scripts/refresh-sanctions.mjs <path-or-url>       # or from a saved copy / mirror
 *   node scripts/refresh-sanctions.mjs <src> --allow-removals
 *
 * Writes two files and touches nothing else in them:
 *
 *   data/risk-lists.json            `sanctioned` — every digital-currency address on
 *                                   the list that decodes as a TRON mainnet address,
 *                                   whatever asset OFAC filed it under. `mixers` and
 *                                   `community` are carried over exactly as they were.
 *   data/sanctions-multichain.json  every other digital-currency address on the list,
 *                                   for screening an address on another chain.
 *
 * Why "whatever asset". OFAC files an address under the asset the designation
 * names, and a designation that names the token rather than the chain files a
 * TRON address under "Digital Currency Address - USDT". The first extraction
 * (8 Sep 2026) kept "- TRX" only and so missed every one of those — in a tool
 * whose whole scope is USDT on TRON. Decoding the address, rather than trusting
 * the asset field, is what catches them.
 *
 * Two guards, because a sanctions table that silently shrinks is worse than a
 * stale one:
 *   - every address the current file flags must still be on the new list. A
 *     delisting is possible, but it has to be looked at, not absorbed; pass
 *     --allow-removals once it has been.
 *   - a source with no digital-currency addresses at all is refused outright
 *     (a truncated download, or an error page saved as XML).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const OFFICIAL = "https://www.treasury.gov/ofac/downloads/sdn.xml";
const args = process.argv.slice(2);
const allowRemovals = args.includes("--allow-removals");
const source = args.find((a) => !a.startsWith("--")) ?? OFFICIAL;

const RISK = new URL("../data/risk-lists.json", import.meta.url);
const MULTI = new URL("../data/sanctions-multichain.json", import.meta.url);

/* ---------------------------------------------------------------- read */

async function readSource(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { redirect: "follow" });
    if (!res.ok) throw new Error(`${src} answered HTTP ${res.status}`);
    return res.text();
  }
  return readFileSync(src, "utf8");
}

const xml = await readSource(source);

/* --------------------------------------------------------------- parse */

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

/** First element's text inside `block`, or null. */
const first = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : null;
};

/** The nested lists carry their own names (a.k.a.s, addresses); cut them out
    before reading the entry's own name, so an alias is never taken for it. */
const NESTED = ["akaList", "addressList", "nationalityList", "citizenshipList",
  "dateOfBirthList", "placeOfBirthList", "vesselInfo"];

const published = (() => {
  const d = first(xml, "Publish_Date"); // MM/DD/YYYY
  const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
})();

const PREFIX = "Digital Currency Address - ";
const listed = []; // { address, asset, entity, programs[] } in document order

for (const [, entry] of xml.matchAll(/<sdnEntry>([\s\S]*?)<\/sdnEntry>/g)) {
  const ids = entry.match(/<idList>([\s\S]*?)<\/idList>/)?.[1];
  if (!ids || !ids.includes(PREFIX)) continue;

  let own = entry;
  for (const tag of NESTED) own = own.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"), "");
  const entity = [first(own, "firstName"), first(own, "lastName")].filter(Boolean).join(" ");
  const programs = [...(own.match(/<programList>([\s\S]*?)<\/programList>/)?.[1] ?? "")
    .matchAll(/<program>([\s\S]*?)<\/program>/g)].map((m) => decode(m[1]));

  for (const [, id] of ids.matchAll(/<id>([\s\S]*?)<\/id>/g)) {
    const type = first(id, "idType");
    const number = first(id, "idNumber");
    if (!type?.startsWith(PREFIX) || !number) continue;
    listed.push({ address: number, asset: type.slice(PREFIX.length), entity, programs });
  }
}

if (listed.length === 0) {
  console.error(`No "${PREFIX}…" entries in ${source}. Refusing to write — is this really sdn.xml?`);
  process.exit(1);
}

/* ------------------------------------------------------- TRON or not */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const sha = (b) => createHash("sha256").update(b).digest();

/** Full base58check, 0x41 mainnet prefix — the same test lib/tron.ts applies. */
function isTron(address) {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  let n = 0n;
  for (const ch of address) n = n * 58n + BigInt(B58.indexOf(ch));
  const hex = n.toString(16).padStart(50, "0");
  if (hex.length !== 50) return false;
  const bytes = Buffer.from(hex, "hex");
  if (bytes[0] !== 0x41) return false;
  return sha(sha(bytes.subarray(0, 21))).subarray(0, 4).equals(bytes.subarray(21));
}

/** One row per address. EVM hex is case-insensitive, so it merges on lower case. */
function merge(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const key = /^0x[0-9a-f]{40}$/i.test(r.address) ? r.address.toLowerCase() : r.address;
    const row = byKey.get(key);
    if (!row) {
      byKey.set(key, { address: r.address, assets: [r.asset], entities: [r.entity], programs: [...r.programs] });
      continue;
    }
    if (!row.assets.includes(r.asset)) row.assets.push(r.asset);
    if (!row.entities.includes(r.entity)) row.entities.push(r.entity);
    for (const p of r.programs) if (!row.programs.includes(p)) row.programs.push(p);
  }
  return [...byKey.values()];
}

const tron = merge(listed.filter((r) => isTron(r.address)));
const other = merge(listed.filter((r) => !isTron(r.address)));

/* --------------------------------------------------------------- guard */

const current = JSON.parse(readFileSync(RISK, "utf8"));
const kept = new Set(tron.map((r) => r.address));
const removed = (current.sanctioned ?? []).filter((r) => !kept.has(r.address));
if (removed.length && !allowRemovals) {
  console.error(`${removed.length} address(es) flagged today are not on this list:`);
  for (const r of removed) console.error(`  ${r.address}  ${r.entity ?? ""}`);
  console.error("Look at each (a delisting is possible), then re-run with --allow-removals.");
  process.exit(1);
}

/* --------------------------------------------------------------- write */

const today = new Date().toISOString().slice(0, 10);
const provenance = {
  _source:
    "OFAC Specially Designated Nationals list (sdn.xml). Regenerated by scripts/refresh-sanctions.mjs.",
  _via: source,
  _published: published,
  _retrieved: today,
};

const tronRows = tron.map((r) => ({
  address: r.address,
  list: "OFAC SDN",
  entity: r.entities.join(" / "),
  program: r.programs.join(", ") || undefined,
  asset: r.assets.join(", "),
}));

const previous = (current.sanctioned ?? []).length;
const added = tronRows.filter((r) => !(current.sanctioned ?? []).some((c) => c.address === r.address));

writeFileSync(
  RISK,
  JSON.stringify(
    {
      ...provenance,
      _filter:
        "Every digital-currency address on the list that decodes as a TRON mainnet address (base58check, 0x41 prefix), whatever asset OFAC filed it under — most are filed under TRX, the rest under USDT. `asset` records which.",
      _note_refresh: `${tronRows.length} addresses. Every one of the ${previous} flagged before this refresh is still listed; ${added.length} added.`,
      _note_mixers: current._note_mixers,
      _note_community: current._note_community,
      sanctioned: tronRows,
      mixers: current.mixers ?? [],
      community: current.community ?? [],
    },
    null,
    2,
  ) + "\n",
);

const assets = {};
for (const r of other) for (const a of r.assets) assets[a] = (assets[a] ?? 0) + 1;

writeFileSync(
  MULTI,
  JSON.stringify(
    {
      ...provenance,
      _note:
        "Every OFAC-listed digital-currency address that is not a TRON address, for screening an address from another chain. TRON addresses live in risk-lists.json, where the tracer reads them. Screening is an exact match: an address that is not here is not thereby cleared.",
      count: other.length,
      assets: Object.fromEntries(Object.entries(assets).sort((a, b) => b[1] - a[1])),
      addresses: other.map((r) => ({
        address: r.address,
        assets: r.assets,
        entity: r.entities.join(" / "),
        program: r.programs.join(", ") || undefined,
      })),
    },
    null,
    2,
  ) + "\n",
);

const byAsset = {};
for (const r of tronRows) byAsset[r.asset] = (byAsset[r.asset] ?? 0) + 1;
console.log(`OFAC list published ${published ?? "(date not found)"}, read from ${source}`);
console.log(`TRON: ${tronRows.length} addresses (${previous} before, ${added.length} added)`, byAsset);
console.log(`Other chains: ${other.length} addresses across ${Object.keys(assets).length} assets`, assets);
console.log(`Entities: ${new Set(tronRows.map((r) => r.entity)).size} on TRON, ${new Set(other.map((r) => r.entities.join(" / "))).size} elsewhere`);
