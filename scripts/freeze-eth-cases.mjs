/**
 * Capture real Ethereum cases into the recorded case file — the Ethereum side
 * of `freeze-cases.mjs`, with the same convention and the same refusals.
 *
 *   node scripts/freeze-eth-cases.mjs              # WARM, COLD and HOT
 *   node scripts/freeze-eth-cases.mjs WARM         # one level, the rest left alone
 *
 * Needs the app running WITHOUT demo mode (PORT, default 3000): a demo-mode
 * server would answer from the very file this writes.
 *
 * Candidates come from the committed data and the chain, and a case is kept
 * only when the pipeline independently reaches the disposition asked for, with
 * no unread wallet on its path:
 *
 *   WARM  an ordinary wallet that paid a derived deposit address — Indian
 *         exchanges (CoinDCX, WazirX) first.
 *   COLD  an ordinary wallet that paid an OFAC-listed Ethereum address.
 *   HOT   an ordinary wallet that received USDT recently and has sent none.
 *
 * "Ordinary" means its whole USDT history fits one explorer page, so the trace
 * reads it entirely. The fraud date is anchored 60 seconds before a real
 * transfer, never chosen to make a rule fire. These wallets are selected by a
 * script, not reported by victims, and `selectedBecause` says exactly why each
 * was chosen; nothing may describe their money as fraud proceeds.
 */

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.env.PORT ?? "3000";
const APP = `http://localhost:${PORT}`;
const BS = "https://eth.blockscout.com/api/v2";
const RPC = "https://ethereum-rpc.publicnode.com";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const FILE = new URL("../data/demo-cases.json", import.meta.url);
const WANT = (process.argv.slice(2).filter((a) => /^(WARM|COLD|HOT)$/.test(a)).length
  ? process.argv.slice(2).filter((a) => /^(WARM|COLD|HOT)$/.test(a))
  : ["WARM", "COLD", "HOT"]);
const MAX_TRIES = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lc = (a) => String(a).toLowerCase();

async function page(address, filter = "") {
  await sleep(380);
  try {
    const res = await fetch(
      `${BS}/addresses/${address}/token-transfers?type=ERC-20&token=${USDT}${filter ? `&filter=${filter}` : ""}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) },
    );
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function rpc(method, params) {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
    const js = await res.json();
    return js.error ? null : js.result;
  } catch {
    return null;
  }
}

const isWallet = (party) => party && (!party.is_contract || party.proxy_type === "eip7702");
const value = (t) => Number(BigInt(t.total?.value ?? "0")) / 1e6;

/** A wallet whose whole USDT history is one page, or null. */
async function ordinary(address) {
  const js = await page(address);
  if (!js?.items || js.next_page_params || js.items.length >= 50) return null;
  return js.items;
}

/* ------------------------------------------------------------- candidates */

/** Payers into a set of target addresses, as {address, amount, fraudDate, why}. */
async function* payersInto(targets, label) {
  let n = 0;
  for (const target of targets) {
    if (++n % 10 === 0) console.log(`  … ${n} targets searched`);
    const js = await page(target.address, "to");
    const checked = new Set();
    for (const t of js?.items ?? []) {
      if (lc(t.to.hash) !== lc(target.address) || value(t) < 20 || !isWallet(t.from)) continue;
      // Three distinct payers per target at most: the search stays minutes, not hours.
      if (checked.has(lc(t.from.hash))) continue;
      if (checked.size >= 3) break;
      checked.add(lc(t.from.hash));
      const history = await ordinary(t.from.hash);
      if (!history) continue;
      yield {
        address: t.from.hash,
        request: { amount: value(t), fraudDate: new Date(Date.parse(t.timestamp) - 60_000).toISOString() },
        why: `paid ${value(t).toFixed(2)} USDT to ${label(target)} ${target.address} on ${t.timestamp.slice(0, 10)}; its whole USDT history (${history.length} transfers) fits one page, so the trace reads all of it`,
      };
      break; // one payer per target keeps the candidates varied
    }
  }
}

async function* warmCandidates() {
  const rows = JSON.parse(readFileSync(new URL("../data/eth/deposit-addresses.json", import.meta.url), "utf8"));
  const indian = new Set(["CoinDCX", "WazirX"]);
  const ordered = [
    ...rows.filter((r) => indian.has(r.exchange) && !r.windowTruncated),
    ...rows.filter((r) => !indian.has(r.exchange) && !r.windowTruncated),
  ];
  yield* payersInto(ordered, (r) => `a derived ${r.exchange} customer deposit address`);
}

async function* coldCandidates() {
  const multichain = JSON.parse(readFileSync(new URL("../data/sanctions-multichain.json", import.meta.url), "utf8"));
  const listed = multichain.addresses.filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a.address));
  yield* payersInto(listed, (a) => `the OFAC-listed address of ${a.entity}`);
}

async function* hotCandidates() {
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  const seen = new Set();
  for (let from = head - 300; from > head - 3000; from -= 300) {
    const logs = await rpc("eth_getLogs", [
      { address: USDT, topics: [TRANSFER], fromBlock: "0x" + from.toString(16), toBlock: "0x" + (from + 299).toString(16) },
    ]);
    for (const l of (logs ?? []).slice(0, 400)) {
      const to = "0x" + l.topics[2]?.slice(26);
      if (!to || seen.has(to) || Number(BigInt(l.data)) / 1e6 < 100) continue;
      seen.add(to);
      const history = await ordinary(to);
      if (!history || history.some((t) => lc(t.from.hash) === lc(to))) continue; // has sent USDT
      if (!isWallet(history[0]?.to)) continue;
      const first = history.map((t) => Date.parse(t.timestamp)).sort((a, b) => a - b)[0];
      const received = history.reduce((s, t) => s + value(t), 0);
      yield {
        address: history[0].to.hash,
        request: { fraudDate: new Date(first - 60_000).toISOString() },
        why: `received ${received.toFixed(2)} USDT across ${history.length} transfer(s) and has never sent any — its whole history read from one page`,
      };
    }
  }
}

/* ---------------------------------------------------------------- capture */

async function capture(candidate, level) {
  const res = await fetch(`${APP}/api/trace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: candidate.address, ...candidate.request }),
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  if (res.headers.get("x-finex-provenance") !== "live") return { ok: false, reason: "not a live trace" };
  const trace = await res.json();
  if (trace.chain !== "ethereum") return { ok: false, reason: "not traced on Ethereum" };
  if (trace.triage !== level) return { ok: false, reason: `came back ${trace.triage}` };
  // An unread wallet on the path would make the case rest on what we could not see.
  const unread = trace.nodes.filter((n) => n.depth > 0 && !n.label && n.firstSeen === null);
  if (unread.length) return { ok: false, reason: `${unread.length} unread wallet(s) on the path` };
  return { ok: true, trace };
}

const health = await fetch(`${APP}/api/health`).then((r) => r.json()).catch(() => null);
if (!health) {
  console.error(`No app answering at ${APP}. Start it without demo mode first.`);
  process.exit(1);
}
if (health.demoMode) {
  console.error("The app is in demo mode — it would answer from the file this script writes. Restart it without DEMO_MODE.");
  process.exit(1);
}

const file = JSON.parse(readFileSync(FILE, "utf8"));
const captured = [];
const finders = { WARM: warmCandidates, COLD: coldCandidates, HOT: hotCandidates };

for (const level of WANT) {
  let tries = 0;
  for await (const candidate of finders[level]()) {
    if (tries++ >= MAX_TRIES) break;
    process.stdout.write(`${level}: ${candidate.address} … `);
    const got = await capture(candidate, level);
    if (!got.ok) {
      console.log(got.reason);
      continue;
    }
    console.log(`kept — ${got.trace.triageReason}`);
    captured.push({
      address: got.trace.inputAddress,
      capturedAt: new Date().toISOString(),
      triage: level,
      selectedBecause: candidate.why,
      request: candidate.request,
      trace: got.trace,
    });
    break;
  }
}

if (!captured.length) {
  console.log("\nNothing captured; the case file is unchanged.");
  process.exit(1);
}

// Backed up outside the repository, so a backup is never committed by accident.
const backup = join(tmpdir(), `demo-cases.backup-${Date.now()}.json`);
copyFileSync(FILE, backup);
const replacing = new Set(captured.map((c) => c.triage));
// An earlier Ethereum capture at the same level is replaced; TRON cases are never touched.
const kept = file.cases.filter((c) => !(/^0x/i.test(c.address) && replacing.has(c.triage)));
writeFileSync(FILE, `${JSON.stringify({ ...file, cases: [...kept, ...captured] }, null, 2)}\n`);
console.log(`\nWrote ${captured.length} Ethereum case(s); ${kept.length} kept. Backup: ${backup}`);
