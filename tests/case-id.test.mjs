import { test } from "node:test";
import assert from "node:assert/strict";
import { caseIdFor } from "../lib/tracer.ts";
import demo from "../data/demo-cases.json" with { type: "json" };

const cases = Array.isArray(demo) ? demo : demo.cases;

test("every recorded case carries the reference its wallet derives", () => {
  for (const { trace } of cases) {
    assert.equal(trace.caseId, caseIdFor(trace.chain ?? "tron", trace.inputAddress), trace.inputAddress);
  }
});

test("one wallet, one reference; a chain is part of the wallet", () => {
  const a = "0x77fB78EAC2021Cd52097168873324d3F1200E275";
  assert.equal(caseIdFor("ethereum", a), caseIdFor("ethereum", a.toLowerCase()));
  assert.notEqual(caseIdFor("ethereum", a), caseIdFor("polygon", a));
  assert.match(caseIdFor("tron", "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx"), /^FX-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
});
