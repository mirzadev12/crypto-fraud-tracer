/**
 * Check a recorded case against the chain, without trusting this repository.
 *
 *   node scripts/verify-case.mjs                     # every recorded case
 *   node scripts/verify-case.mjs TUGHe9CTbZ…         # one of them
 *   node scripts/verify-case.mjs --file packet.json  # a packet somebody sent you
 *
 * Every chain response this pipeline reads is SHA-256'd and the digests travel
 * into the evidence packet. That was a good property with a hole in it: nobody
 * could *use* them. A hash an officer cannot check is decoration, and an
 * evidence tool whose evidence has to be taken on trust is a dashboard.
 *
 * So this re-reads the transactions a case rests on, straight from the public
 * chain, and reports whether they still say what the case says they said. It
 * imports nothing from the tracer and recomputes nothing through it — it reads
 * the committed result and the chain, and compares. A bug in the tracer cannot
 * make this pass.
 *
 * What a pass means, stated precisely because the distinction is the point:
 *
 *   CONFIRMED   the transaction exists on chain, moved the USDT amount the
 *               case records, between the two addresses the case names, at the
 *               timestamp it records.
 *   MISMATCH    it exists and disagrees. This is the finding that matters.
 *   MISSING     the chain has no such transfer.
 *   UNREADABLE  the endpoint would not answer. Not a failure of the case, and
 *               never counted as one.
 *
 * What it cannot do: confirm that a labelled address belongs to the exchange
 * named beside it. No public data establishes that — only the exchange can, and
 * every screen in this product says so.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/*
 * The chain returns event parameters as 20-byte hex, not base58. Comparing
 * those to the base58 addresses in a case file makes every transfer look like
 * a mismatch, which is exactly what the first run of this script reported — a
 * verifier that cries wolf is worse than none, because the next real mismatch
 * gets waved through. The repo already has the encoder `lib/txlookup.ts` uses
 * for this; borrow it rather than writing a second one that can drift.
 */
const require_ = createRequire(import.meta.url);
let hexToTronAddress;
try {
  ({ hexToTronAddress } = require_("../lib/tron.ts"));
} catch (err) {
  // Loud, not silent. Without the encoder every address comparison fails and
  // the script would report a clean case as entirely mismatched — a verifier
  // that is wrong in the alarming direction is worse than no verifier at all.
  console.error(
    "Could not load hexToTronAddress from lib/tron.ts, so chain addresses\n" +
      "cannot be compared. Node 22.18+ is needed to require a TypeScript module.\n" +
      `Reason: ${err?.code ?? err?.message ?? err}`,
  );
  process.exit(1);
}

/*
 * Ethereum: a raw node's receipt, decoded here. The case was traced through
 * Blockscout; the check reads a different provider, so the two can only agree
 * if the chain does. The decoder is borrowed for the same reason as above.
 */
let wordToAddress;
try {
  ({ wordToAddress } = require_("../lib/evm.ts"));
} catch (err) {
  console.error(`Could not load wordToAddress from lib/evm.ts: ${err?.code ?? err?.message ?? err}`);
  process.exit(1);
}
/*
 * Public nodes differ in how far back they index transactions: on 25 Sep 2026
 * publicnode answered null for a 2021 transaction that drpc, Cloudflare, 1rpc
 * and Blast all returned. So each hash is asked of several, and only when none
 * has it is it reported — as unreadable, not missing, since an index that does
 * not reach back that far is a limit of the node, not a fact about the chain.
 */
const ETH_RPCS = (process.env.ETH_RPC_URL ? [process.env.ETH_RPC_URL] : []).concat([
  "https://eth.drpc.org",
  "https://cloudflare-eth.com",
  "https://1rpc.io/eth",
  "https://eth-mainnet.public.blastapi.io",
  "https://ethereum-rpc.publicnode.com",
]);
const ETH_USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpc(method, params, url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const js = await res.json();
  if (js.error) throw new Error(js.error.message ?? "rpc error");
  return js.result;
}

/** One Ethereum transaction's USDT transfers, from the node's receipt. */
async function fetchEthTransfers(txHash) {
  for (const url of ETH_RPCS) {
    try {
      const receipt = await rpc("eth_getTransactionReceipt", [txHash], url);
      // Null: this node does not index it. Ask the next one.
      if (!receipt) continue;
      if (receipt.status !== "0x1") return [];
      const block = await rpc("eth_getBlockByNumber", [receipt.blockNumber, false], url);
      const at = block ? parseInt(block.timestamp, 16) * 1000 : 0;
      return receipt.logs
        .filter(
          (l) =>
            String(l.address).toLowerCase() === ETH_USDT &&
            l.topics?.[0] === TRANSFER_TOPIC &&
            l.topics.length === 3,
        )
        .map((l) => ({
          from: wordToAddress(l.topics[1]) ?? "",
          to: wordToAddress(l.topics[2]) ?? "",
          value: Number(BigInt(l.data)) / 1e6,
          at,
        }));
    } catch {
      await sleep(400);
    }
  }
  return null;
}

/** base58 already, or the 20-byte hex an event parameter carries. */
function normalizeAddress(value) {
  const v = String(value ?? "");
  if (!v) return "";
  if (v.startsWith("T") && v.length === 34) return v;
  return hexToTronAddress(v) ?? v;
}

const BASE = "https://api.trongrid.io";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const flag = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const KEY = flag("key") ?? process.env.TRONGRID_API_KEY ?? "";
const only = process.argv.slice(2).find((a) => !a.startsWith("--") && a.length > 20);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** USDT carries six decimals; a cent of float drift is not a mismatch. */
const EPSILON = 0.01;

/** One transaction, read back from the chain by its own hash. */
async function fetchTransfers(txHash) {
  if (/^0x/i.test(txHash)) return fetchEthTransfers(txHash);
  const url = `${BASE}/v1/transactions/${txHash}/events?only_confirmed=true`;
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
      const body = await res.json();
      const events = Array.isArray(body.data) ? body.data : [];
      return events
        .filter(
          (e) =>
            e.event_name === "Transfer" &&
            String(e.contract_address ?? "").toLowerCase() === USDT.toLowerCase(),
        )
        .map((e) => ({
          from: normalizeAddress(e.result?.from ?? e.result?.["0"] ?? ""),
          to: normalizeAddress(e.result?.to ?? e.result?.["1"] ?? ""),
          value: Number(BigInt(String(e.result?.value ?? e.result?.["2"] ?? "0"))) / 1e6,
          at: e.block_timestamp ?? 0,
        }));
    } catch {
      await sleep(1200 * (attempt + 1));
    }
  }
  return null;
}

function verdictFor(edge, onChain) {
  if (onChain === null) return { status: "UNREADABLE", note: "endpoint would not answer" };
  if (onChain.length === 0) return { status: "MISSING", note: "no USDT transfer in this transaction" };

  // An Ethereum address is case-insensitive; a TRON address is not.
  const same = (a, b) => (/^0x/i.test(a) ? a.toLowerCase() === String(b).toLowerCase() : a === b);
  const match = onChain.find(
    (t) =>
      same(t.from, edge.from) &&
      same(t.to, edge.to) &&
      Math.abs(t.value - edge.valueUsdt) <= EPSILON,
  );
  if (match) {
    const recorded = Date.parse(edge.timestamp);
    const drift = Number.isFinite(recorded) ? Math.abs(match.at - recorded) : 0;
    // A block timestamp is the block's, so a few seconds is the chain, not a
    // discrepancy. Minutes would be.
    if (drift > 120_000) {
      return { status: "MISMATCH", note: `timestamp differs by ${Math.round(drift / 1000)}s` };
    }
    return { status: "CONFIRMED", note: "" };
  }

  const sameParties = onChain.find((t) => same(t.from, edge.from) && same(t.to, edge.to));
  if (sameParties) {
    return {
      status: "MISMATCH",
      note: `chain says ${sameParties.value.toFixed(2)} USDT, case says ${edge.valueUsdt.toFixed(2)}`,
    };
  }
  return { status: "MISMATCH", note: "same transaction, different parties" };
}

/* ------------------------------------------------------------------ input */

let cases;
const packetPath = flag("file");
if (packetPath) {
  const parsed = JSON.parse(readFileSync(packetPath, "utf8"));
  const trace = parsed.trace ?? parsed;
  cases = [{ address: trace.inputAddress, trace }];
} else {
  const file = JSON.parse(readFileSync("data/demo-cases.json", "utf8"));
  cases = file.cases.filter((c) => !only || c.address === only);
}

if (cases.length === 0) {
  console.error("No case matched. Pass a recorded address, or --file <packet.json>.");
  process.exit(1);
}

/* ---------------------------------------------------------------- verify */

let totals = { CONFIRMED: 0, MISMATCH: 0, MISSING: 0, UNREADABLE: 0 };

for (const entry of cases) {
  const trace = entry.trace;
  console.log(`\n${"═".repeat(66)}`);
  console.log(`${trace.caseId}  ${trace.inputAddress}`);
  console.log(
    `${trace.triage} · ${trace.edges.length} transfers · captured ${String(trace.provenance?.generatedAt ?? "").slice(0, 10)}`,
  );
  console.log("─".repeat(66));

  for (const edge of trace.edges) {
    if (!edge.txHash) {
      console.log(`  SKIPPED    (edge carries no transaction hash)`);
      continue;
    }
    const onChain = await fetchTransfers(edge.txHash);
    const v = verdictFor(edge, onChain);
    totals[v.status] += 1;
    const mark =
      v.status === "CONFIRMED" ? "✓" : v.status === "UNREADABLE" ? "·" : "✗";
    console.log(
      `  ${mark} ${v.status.padEnd(10)} ${edge.txHash.slice(0, 16)}…  ` +
        `${edge.valueUsdt.toFixed(2)} USDT${v.note ? `  — ${v.note}` : ""}`,
    );
    await sleep(260);
  }
}

console.log(`\n${"═".repeat(66)}`);
console.log(
  `Confirmed ${totals.CONFIRMED} · mismatched ${totals.MISMATCH} · ` +
    `missing ${totals.MISSING} · unreadable ${totals.UNREADABLE}`,
);
if (totals.MISMATCH || totals.MISSING) {
  console.log(
    "\nA mismatch means the committed case and the chain disagree. Investigate the\n" +
      "case file, not the chain — the chain is the record.",
  );
  process.exit(2);
}
console.log(
  totals.UNREADABLE
    ? "\nEverything the endpoint answered for matches the chain. Unreadable transfers\nare unchecked, not failed — re-run with a TronGrid key to close the gap."
    : "\nEvery transfer in this case still matches the chain.",
);
