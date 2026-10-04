import { test } from "node:test";
import assert from "node:assert/strict";
import { witnessSheet } from "../lib/witness.ts";
import { findingsFingerprint } from "../lib/fingerprint.ts";
import { formatUsdt } from "../lib/format.ts";
import demo from "../data/demo-cases.json" with { type: "json" };

const cases = Array.isArray(demo) ? demo : demo.cases;

// The court-preparation sheet is assembled from the trace, so every figure it
// states must be one the trace holds (lib/witness.ts).
test("every recorded case's sheet quotes only its own figures", () => {
  for (const { trace } of cases) {
    const fingerprint = findingsFingerprint(trace);
    const items = witnessSheet(trace, { fingerprint, recorded: true });
    const text = items.map((i) => `${i.question} ${i.answer} ${i.limit}`).join(" ");
    assert.ok(items.length >= 8, trace.inputAddress);
    assert.ok(text.includes(fingerprint.slice(0, 16)), "fingerprint");
    assert.ok(text.includes(`${trace.provenance.responseHashes.length} response`), "responses");
    if (trace.terminal && trace.terminal.address !== trace.inputAddress) {
      const reached = trace.nodes.find((n) => n.address === trace.terminal.address);
      assert.ok(text.includes(formatUsdt(reached.taintedValueUsdt)), `exit amount ${trace.inputAddress}`);
    }
    // No statute, no model deciding, no claim the attribution is certain.
    assert.doesNotMatch(text, /CrPC|BNSS|Section \d/);
    assert.doesNotMatch(text, /proves|certainly|definitely/i);
  }
});
