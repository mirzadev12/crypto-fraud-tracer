import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/tracer.ts";
import { buildNarrative } from "../lib/narrative.ts";

// The simplest real case: the victim paid straight into an exchange deposit
// address. The reported address itself is the account to name (lib/tracer.ts).
const subject = {
  address: "TQFmtJ6FEXAMPLExxxxxxxxxxxxxBxZWwS",
  depth: 0,
  label: { entity: "Victim-reported address", kind: "victim_reported", confidence: 1, source: "ground_truth" },
  taintedValueUsdt: 500,
  taintFraction: 1,
  firstSeen: "2026-09-01T00:00:00.000Z",
  outflowCount: 12,
};
const ctx = {
  rootFollowed: 0,
  unseen: new Set(),
  rootReceived: 500,
  rootReadFrom: null,
  windowStart: Date.parse("2026-09-01T00:00:00.000Z"),
  fraudDateReported: true,
  chainName: "TRON",
};
const deposit = { entity: "MEXC", kind: "exchange_deposit", confidence: 0.95, source: "heuristic", evidence: "31 sweeps" };

test("a reported deposit address is the exit, named as itself", () => {
  const d = decide([subject], { ...ctx, rootOwn: deposit });
  assert.equal(d.triage, "WARM");
  assert.equal(d.terminal.address, subject.address);
  assert.equal(d.terminal.depositAddress, subject.address);
  assert.match(d.triageReason, /^The reported address is itself a likely MEXC customer deposit address/);
  assert.doesNotMatch(d.triageReason, /reached/);
});

test("a reported sanctioned address closes the case", () => {
  const d = decide([subject], { ...ctx, rootOwn: { entity: "ISIL KHORASAN", kind: "sanctioned", confidence: 1, source: "sanctions" } });
  assert.equal(d.triage, "COLD");
  assert.equal(d.terminal.depositAddress, null);
});

test("an unattributed reported address is decided as before", () => {
  const d = decide([subject], { ...ctx, rootOwn: null });
  assert.notEqual(d.terminal?.address, subject.address);
});

test("the summary says what the address is, not that money reached it", () => {
  const d = decide([subject], { ...ctx, rootOwn: deposit });
  const trace = {
    caseId: "FX-TEST", inputAddress: subject.address, chain: "tron", reportedAmountUsdt: 500,
    fraudDate: "2026-09-01T00:00:00.000Z", nodes: [subject], edges: [], riskFlags: [],
    triage: d.triage, triageReason: d.triageReason, terminal: d.terminal,
    provenance: { apiCalls: 1, responseHashes: [], generatedAt: "2026-10-04T00:00:00.000Z" },
  };
  const text = buildNarrative(trace, { amountReported: true });
  assert.match(text, /is itself attributed to a likely MEXC/);
  assert.doesNotMatch(text, /No USDT left/);
  assert.doesNotMatch(text, /reached/);
});
