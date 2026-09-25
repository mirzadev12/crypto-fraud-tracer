import { test } from "node:test";
import assert from "node:assert/strict";
import cases from "../data/demo-cases.json" with { type: "json" };
import { checkHref, findingsFingerprint, readFingerprint, verifyHref } from "../lib/fingerprint.ts";

const warm = cases.cases.find((c) => c.trace.terminal?.depositAddress).trace;
const copy = () => structuredClone(warm);

test("a finding has one fingerprint, whatever order its parts arrive in", () => {
  const shuffled = copy();
  shuffled.nodes.reverse();
  shuffled.edges.reverse();
  shuffled.riskFlags.reverse();
  assert.match(findingsFingerprint(warm), /^[0-9a-f]{64}$/);
  assert.equal(findingsFingerprint(shuffled), findingsFingerprint(warm));
});

test("wording is not covered, so a better sentence cannot fail an older packet", () => {
  const reworded = copy();
  reworded.narrative = "Reworded.";
  reworded.triageReason = "Reworded.";
  reworded.riskFlags.forEach((f) => (f.reason = "Reworded."));
  reworded.provenance.responseHashes = [];
  reworded.provenance.apiCalls = 0;
  assert.equal(findingsFingerprint(reworded), findingsFingerprint(warm));
});

test("every figure and name a packet states is covered", () => {
  const base = findingsFingerprint(warm);
  const changes = [
    (t) => (t.edges[0].valueUsdt += 0.01),
    (t) => (t.edges[0].txHash = t.edges[0].txHash.replace(/.$/, (c) => (c === "0" ? "1" : "0"))),
    (t) => (t.edges[0].timestamp = new Date(new Date(t.edges[0].timestamp).getTime() + 1000).toISOString()),
    (t) => (t.nodes.find((n) => n.label).label.entity = "Another exchange"),
    (t) => (t.terminal.depositAddress = t.inputAddress),
    (t) => (t.terminal.label.confidence = 0.99),
    (t) => (t.triage = "HOT"),
    (t) => (t.reportedAmountUsdt += 1),
    (t) => t.riskFlags.push({ code: "PEEL_CHAIN", reason: "", atAddress: t.inputAddress }),
    (t) => (t.provenance.generatedAt = "2026-01-01T00:00:00.000Z"),
  ];
  for (const change of changes) {
    const altered = copy();
    change(altered);
    assert.notEqual(findingsFingerprint(altered), base, String(change));
  }
});

test("a fingerprint in a link is read only when it is one", () => {
  const fp = findingsFingerprint(warm);
  assert.equal(readFingerprint(fp.toUpperCase()), fp);
  assert.equal(readFingerprint([fp]), fp);
  assert.equal(readFingerprint(fp.slice(1)), undefined);
  assert.equal(readFingerprint(`${fp}0`), undefined);
  assert.equal(readFingerprint("<script>"), undefined);
});

test("the check link re-opens the run the document was built from", () => {
  const fp = findingsFingerprint(warm);
  const params = (href) => new URL(href, "http://x").searchParams;

  // Live, opened bare: amount and window stay automatic; the moment is pinned.
  const bare = params(checkHref(warm, "live", {}, fp));
  assert.equal(bare.has("amount"), false);
  assert.equal(bare.has("since"), false);
  assert.equal(bare.get("asof"), warm.provenance.generatedAt);
  assert.equal(bare.get("fp"), fp);

  // Live, opened pinned: exactly what it was given.
  const pinned = params(checkHref(warm, "live", { amount: 250, since: warm.fraudDate, asOf: warm.provenance.generatedAt, ack: "31609240012345" }, fp));
  assert.equal(pinned.get("amount"), "250");
  assert.equal(pinned.get("since"), warm.fraudDate);
  assert.equal(pinned.get("ack"), "31609240012345");

  // Recorded: the captured run's own figures, however the packet was opened.
  const recorded = params(checkHref(warm, "demo", {}, fp));
  assert.equal(recorded.get("amount"), String(warm.reportedAmountUsdt));
  assert.equal(recorded.get("since"), warm.fraudDate);

  // Illustrative: nothing on the chain to check against.
  assert.equal(checkHref(warm, "illustrative", {}, fp), null);

  assert.ok(verifyHref({ address: warm.inputAddress, asOf: warm.provenance.generatedAt }, fp).startsWith(`/report/${warm.inputAddress}?`));
});
