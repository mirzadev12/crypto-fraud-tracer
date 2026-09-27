import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { lookup, lookupOn } from "../lib/labels.ts";
import { answersFor, frozenAddresses, frozenTrace } from "../lib/demo.ts";
import { traceHref } from "../lib/api.ts";
import { checkHref } from "../lib/fingerprint.ts";
import { readPinned, walletHref, explorerAddressUrl } from "../lib/format.ts";
import { runHref } from "../lib/case-file.ts";
import { readItem } from "../lib/alerts.ts";
import { watchKey } from "../lib/watch.ts";
import polygonDeposits from "../data/polygon/deposit-addresses.json" with { type: "json" };
import polygonSeeds from "../data/polygon/hot-wallets.json" with { type: "json" };
import ethDeposits from "../data/eth/deposit-addresses.json" with { type: "json" };
import multichain from "../data/sanctions-multichain.json" with { type: "json" };

const RECORDED = "0x577d132eF3cCE50B38D768670ACdaC26680902D4";

test("Polygon is looked up only in what was read on Polygon, plus sanctions", () => {
  const derived = polygonDeposits[0];
  assert.equal(lookupOn("polygon", derived.address)?.kind, "exchange_deposit");
  assert.equal(lookupOn("polygon", derived.address)?.source, "heuristic");
  assert.equal(lookupOn("polygon", polygonSeeds[0].address)?.kind, "exchange_hot");

  // An Ethereum deposit address is not thereby a Polygon one.
  const ethOnly = ethDeposits.find((r) => !polygonDeposits.some((p) => p.address.toLowerCase() === r.address.toLowerCase()));
  assert.ok(lookup(ethOnly.address), "labelled on Ethereum");
  assert.equal(lookupOn("polygon", ethOnly.address), null, "…and not on Polygon");

  // A sanctioned key is sanctioned on every EVM chain.
  const listed = multichain.addresses.find((a) => /^0x[0-9a-fA-F]{40}$/.test(a.address));
  assert.equal(lookupOn("polygon", listed.address)?.kind, "sanctioned");
  assert.equal(lookupOn("ethereum", listed.address)?.kind, "sanctioned");
});

test("a recorded Polygon case answers only on Polygon, and batch triage is not offered it", () => {
  const held = frozenTrace(RECORDED, "polygon");
  assert.ok(held, "the recorded Polygon case");
  assert.equal(held.trace.chain, "polygon");
  assert.equal(frozenTrace(RECORDED), null, "the same 0x string on Ethereum is another wallet");
  assert.ok(answersFor(held.trace, { amount: "auto", fraudDate: "auto" }));
  assert.ok(!frozenAddresses().includes(RECORDED));
  // No Ethereum case is ever served for a Polygon request.
  const eth = "0x77fB78EAC2021Cd52097168873324d3F1200E275";
  assert.ok(frozenTrace(eth));
  assert.equal(frozenTrace(eth, "polygon"), null);
});

test("every link out of a Polygon case says Polygon, and no other link changes", () => {
  const polygon = frozenTrace(RECORDED, "polygon").trace;
  const ethereum = frozenTrace("0x77fB78EAC2021Cd52097168873324d3F1200E275").trace;
  assert.match(traceHref("report", polygon), /[?&]chain=polygon(&|$)/);
  assert.doesNotMatch(traceHref("report", ethereum), /chain=/);
  assert.match(checkHref(polygon, "demo", {}), /[?&]chain=polygon&fp=/);
  assert.doesNotMatch(checkHref(ethereum, "demo", {}), /chain=/);
  assert.match(runHref(RECORDED, { amount: "auto", since: "auto", asOf: "2026-09-27T00:00:00.000Z", model: "haircut", chain: "polygon" }), /&chain=polygon$/);
  assert.equal(walletHref(RECORDED, "polygon"), `/wallet/${RECORDED}?chain=polygon`);
  assert.equal(walletHref(RECORDED), `/wallet/${RECORDED}`);
  assert.equal(explorerAddressUrl(RECORDED, "polygon"), `https://polygonscan.com/address/${RECORDED}`);
  assert.equal(explorerAddressUrl(RECORDED), `https://etherscan.io/address/${RECORDED}`);
  assert.deepEqual(readPinned({ chain: "polygon" }), { chain: "polygon" });
  assert.deepEqual(readPinned({ chain: "bsc" }), {}, "only Polygon is ever said");
});

test("a watched Polygon wallet is never taken for the same string on Ethereum", () => {
  const base = { address: RECORDED, caseAddress: RECORDED, caseId: "FX-1", heldUsdt: 5, since: "2026-09-27T00:00:00.000Z" };
  assert.equal(watchKey({ ...base, chain: "polygon" }), `polygon:${RECORDED}`);
  assert.equal(watchKey(base), RECORDED);
  assert.equal(readItem({ ...base, chain: "polygon" }).chain, "polygon");
  assert.equal(readItem({ ...base, address: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx", caseAddress: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx", chain: "polygon" }).chain, undefined, "a TRON address is never Polygon");
});

test("an as-of read on Polygon lands on the exact block, however the block time varied", async () => {
  // Blocks 0–500 two seconds apart, then one second: Polygon's history, in miniature.
  const T0 = Date.UTC(2025, 0, 1);
  const t = (n) => T0 + (n <= 500 ? n * 2000 : 1_000_000 + (n - 500) * 1000);
  const HEAD = 1500;
  const asked = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (url.pathname.endsWith("/main-page/blocks")) return res.end(JSON.stringify([{ height: HEAD, timestamp: new Date(t(HEAD)).toISOString() }]));
    const block = url.pathname.match(/\/blocks\/(\d+)$/);
    if (block) return res.end(JSON.stringify({ timestamp: new Date(t(Number(block[1]))).toISOString() }));
    asked.push(url.searchParams.get("block_number"));
    return res.end(JSON.stringify({ items: [], next_page_params: null }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.POLYGON_BLOCKSCOUT_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const { PolygonClient } = await import("../lib/ethclient.ts");
    for (const [moment, boundary] of [
      [t(300) + 500, 300],
      [t(900) + 999, 900],
      [t(500), 500],
    ]) {
      await new PolygonClient({ asOf: moment }).transfers("0x577d132eF3cCE50B38D768670ACdaC26680902D4");
      assert.equal(asked.at(-1), String(boundary + 1), `as of block ${boundary}`);
    }
  } finally {
    delete process.env.POLYGON_BLOCKSCOUT_URL;
    server.close();
  }
});
