import { test } from "node:test";
import assert from "node:assert/strict";
import { fundingExchanges, payersOf, sourcesOf } from "../lib/payers.ts";
import { displayTag, exchangeFromTags } from "../lib/explorer-tags.ts";

const SUBJECT = "0x57DbDbBFd6155376074640453408bABF7BC7bA2c";
const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const HOT = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";
const t = (from, to, value, timestamp, block) => ({ txHash: `0x${timestamp}`, from, to, value, timestamp, symbol: "USDT", block });

test("payers are grouped by sender, largest first, and dust never counts", () => {
  const rows = payersOf(SUBJECT, [
    t(A, SUBJECT, 100, 1000, 10),
    t(A, SUBJECT, 50, 3000, 30),
    t(B, SUBJECT, 400, 2000, 20),
    t(B, SUBJECT, 0.5, 2500, 25), // poisoning dust
    t(SUBJECT, A, 70, 4000, 40), // an outflow is not a payment in
    t(SUBJECT, SUBJECT, 9, 5000, 50), // nor is a self-transfer
  ]);
  assert.deepEqual(rows.map(([a, r]) => [a, r.paid, r.count]), [[B, 400, 1], [A, 150, 2]]);
  const a = rows.find(([addr]) => addr === A)[1];
  assert.equal(a.first, 1000);
  assert.equal(a.last, 3000);
  assert.equal(a.lastBlock, 30, "the block of the last payment, so its funding can be read from there");
});

test("a payer's sources are what came in before it paid, largest first", () => {
  const sources = sourcesOf(
    A,
    [
      t(HOT, A, 500, 900),
      t(B, A, 20, 950),
      t(B, A, 0.2, 960), // dust
      t(HOT, A, 800, 5000), // after its payment: not what funded it
      t(A, SUBJECT, 100, 1000),
    ],
    1000,
    (address) => (address === HOT ? ["Binance: Hot Wallet", "HOT WALLET", "Exchange", "Binance"] : []),
  );
  assert.deepEqual(sources.map((s) => [s.address, s.usdt, s.tags.length > 0]), [[HOT, 500, true], [B, 20, false]]);
});

test("an explorer's tags name an exchange only when filed under Exchange", () => {
  assert.equal(exchangeFromTags(["Binance: Hot Wallet", "HOT WALLET", "Exchange", "Binance"]), "Binance");
  assert.equal(exchangeFromTags(["Exchange", "Binance", "Binance 12"]), "Binance");
  assert.equal(exchangeFromTags(["Binance 12", "Exchange"]), "Binance");
  assert.equal(exchangeFromTags(["SIPDapp"]), null);
  assert.equal(exchangeFromTags([]), null);
  assert.equal(displayTag(["Exchange", "Binance"]), "Binance");
  assert.equal(displayTag(["Exchange"]), "Exchange");
});

test("an exchange is credited once per payer, and the register outranks a tag", () => {
  const payer = (address, paidUsdt, status, sources = [], label = null) => ({
    address, label, paidUsdt, transfers: 1, firstAt: "", lastAt: "", status, sources, partial: false,
  });
  const src = (tags, label = null) => ({ address: `0x${tags.length}${label ? "L" : "T"}`, label, tags, usdt: 1 });
  const binanceLabel = { entity: "Binance", kind: "exchange_hot", confidence: 1, source: "ground_truth" };
  const rows = fundingExchanges([
    payer(A, 100, "read", [src(["Binance: Hot Wallet", "Exchange"]), src(["Exchange", "Binance 12"])]),
    payer(B, 50, "read", [src([], binanceLabel)]),
    payer("0xc", 30, "labelled", [], { entity: "CoinSwitch", kind: "exchange_hot", confidence: 1, source: "ground_truth" }),
    payer("0xd", 10, "unreadable", [src(["Binance: Hot Wallet", "Exchange"])]),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.entity, r.payers, r.paidUsdt, r.via]),
    [["Binance", 2, 150, "table"], ["CoinSwitch", 1, 30, "table"]],
  );
});
