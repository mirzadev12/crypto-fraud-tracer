import { test } from "node:test";
import assert from "node:assert/strict";
import { isTerminal, lookupOn } from "../lib/labels.ts";
import { categoryOf } from "../lib/contracts.ts";
import data from "../data/tron-contracts.json" with { type: "json" };
import demo from "../data/demo-cases.json" with { type: "json" };

test("a SunSwap pool or router stops a TRON trace as a DeFi contract", () => {
  const pool = lookupOn("tron", "TFGDbUyP8xez44C76fin3bn3Ss6jugoUwJ");
  assert.equal(pool.kind, "contract");
  assert.equal(categoryOf(pool), "defi");
  assert.ok(isTerminal(pool));
  // The USDT token contract itself is never a stop.
  assert.equal(lookupOn("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"), null);
});

test("no recorded case passes through a listed contract, so none changes", () => {
  const listed = new Set(data.contracts.map((c) => c.address));
  for (const { trace } of Array.isArray(demo) ? demo : demo.cases) {
    for (const n of trace.nodes) assert.ok(!listed.has(n.address), `${trace.inputAddress} → ${n.address}`);
  }
});
