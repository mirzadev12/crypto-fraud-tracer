import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGAL_BASES, legalBasis, regimeFor, regimeOf } from "../lib/legal-basis.ts";

test("only the sections the research note verified are offered", () => {
  const ids = LEGAL_BASES.map((b) => b.id).sort();
  assert.deepEqual(ids, ["bnss-105", "bnss-106", "bnss-107", "bnss-94", "bsa-63"]);
  for (const b of LEGAL_BASES) {
    assert.ok(b.cite.length > 0 && b.purpose.length > 0);
    assert.equal(b.regime, "new");
  }
});

test("nothing claims a section freezes a wallet", () => {
  for (const b of LEGAL_BASES) assert.doesNotMatch(`${b.cite} ${b.purpose}`, /freez/i);
});

test("an unknown id is refused; matters before 1 July 2024 fall to the old laws", () => {
  assert.equal(legalBasis("bnss-94").cite, "BNSS 2023, s.94");
  assert.equal(legalBasis("made-up"), undefined);
  assert.equal(regimeOf("2024-06-30T18:00:00.000Z"), "old"); // 23:30 IST, 30 June
  assert.equal(regimeOf("2024-06-30T23:59:00.000Z"), "new"); // already 05:29 IST, 1 July
  assert.equal(regimeOf("2024-07-01T00:00:00.000+05:30"), "new");
});

test("the regime turns on whether the matter was pending, which the officer states", () => {
  const before = "2024-05-10T00:00:00.000Z";
  const after = "2024-07-02T00:00:00.000Z";
  // A fraud from before the commencement, status not stated: ask, never assume.
  assert.equal(regimeFor(before, "unstated"), "check");
  // Reported after the commencement: the new laws, whatever the fraud date.
  assert.equal(regimeFor(before, "no"), "new");
  // Stated as pending on 1 July 2024: the earlier laws.
  assert.equal(regimeFor(before, "yes"), "old");
  // A fraud after the commencement cannot have been pending before it.
  assert.equal(regimeFor(after, "unstated"), "new");
});
