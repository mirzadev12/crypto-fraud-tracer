import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize, categoryOf, contractLabel, stopsTrace } from "../lib/contracts.ts";

const contract = (tags, extra = {}) => ({ isContract: true, name: null, proxyType: null, tags, ...extra });

// Tag strings as the Ethereum explorer returned them on 26 Sep 2026.
test("a bridge is read as a bridge, whether or not its tags say the word", () => {
  assert.equal(categorize(contract(["Allbridge: LP-USDT Token", "Token Contract", "Pool", "Allbridge"])), "bridge", "Allbridge's USDT pool");
  assert.equal(categorize(contract(["Allbridge: Core Bridge", "Allbridge"])), "bridge");
  assert.equal(categorize(contract(["USDT0: OAdapterUpgradeable"])), "bridge", "USDT0 leaves Ethereum through a LayerZero adapter");
  assert.equal(categorize(contract(["USDT0 OFT Adapter"])), "bridge");
  assert.equal(categorize(contract(["Polygon (Matic): ERC20 Bridge"])), "bridge");
});

test("a DEX pool is still a DeFi contract, and anything else is 'other'", () => {
  assert.equal(categorize(contract(["Uniswap V3: USDT 3", "Pool"])), "defi");
  assert.equal(categorize(contract(["CoW Protocol: GPv2Settlement", "DEX"])), "defi");
  assert.equal(categorize(contract(["USDT0: Safe"])), "other", "the USDT0 team's multisig is not the bridge");
  assert.equal(categorize(contract([])), "other");
});

test("the label says what the contract is, and the category reads back from it", () => {
  const label = contractLabel(contract(["Allbridge: LP-USDT Token", "Token Contract", "Pool", "Allbridge"]));
  assert.equal(label.entity, "Allbridge: LP-USDT Token");
  assert.equal(label.kind, "contract");
  assert.match(label.evidence, /cross-chain bridge/);
  assert.equal(categoryOf(label), "bridge");
});

test("contract wallets are followed, not stopped at", () => {
  assert.equal(stopsTrace(contract(["Allbridge"])), true);
  assert.equal(stopsTrace(contract([], { proxyType: "eip7702" })), false);
  assert.equal(stopsTrace(contract([], { name: "GnosisSafeProxy" })), false);
  assert.equal(stopsTrace({ isContract: false, name: null, proxyType: null, tags: [] }), false);
  assert.equal(stopsTrace(null), false);
});
