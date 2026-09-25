import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leContact } from "../lib/le-contacts.ts";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

// Every exchange a label can name — the freeze request is addressed to one of
// these — must have been looked up. A seed added without a contact fails here
// until its channel is read from its own site (or recorded as not found).
test("every exchange FineX can name has a recorded contact entry", () => {
  const names = new Set();
  for (const file of [
    "data/hot-wallets.json",
    "data/deposit-addresses.json",
    "data/eth/hot-wallets.json",
    "data/eth/deposit-addresses.json",
    "data/eth/consolidation-wallets.json",
  ]) {
    for (const row of json(file)) {
      names.add(row.exchange);
      if (row.heldAt) names.add(row.heldAt);
    }
  }
  const missing = [...names].filter((name) => !leContact(name));
  assert.deepEqual(missing, []);
});

test("a found entry carries a channel and its own source; a missing one says why", () => {
  for (const row of json("data/le-contacts.json").exchanges) {
    assert.match(row.checked, /^\d{4}-\d{2}-\d{2}$/, row.exchange);
    if (row.found) {
      assert.ok(row.channels.length > 0, row.exchange);
      assert.match(row.source, /^https:\/\//, row.exchange);
      for (const c of row.channels) assert.match(c.href, /^(https:\/\/|mailto:)/, `${row.exchange} ${c.href}`);
    } else {
      assert.ok(row.reason && row.reason.length > 10, row.exchange);
    }
  }
});

test("names match however they are spelled", () => {
  assert.equal(leContact("gate.io")?.exchange, "Gate.io");
  assert.equal(leContact("GATEIO")?.exchange, "Gate.io");
  assert.equal(leContact("Coinswitch")?.exchange, "CoinSwitch");
  assert.equal(leContact("Not an exchange"), null);
});
