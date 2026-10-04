import { test } from "node:test";
import assert from "node:assert/strict";
import { caseHref, traceHref } from "../lib/api.ts";
import { runQuery } from "../lib/case-file.ts";

// A run's own link replays it as it was asked (lib/api.ts traceHref): an
// automatic amount or window stays automatic, a stated one stays stated.
const base = {
  inputAddress: "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ",
  reportedAmountUsdt: 1131.72,
  fraudDate: "2026-03-14T08:00:00.000Z",
  chain: "tron",
};
const at = "2026-10-04T09:21:00.000Z";

test("an automatic run's link stays automatic", () => {
  const href = traceHref("report", {
    ...base,
    provenance: { generatedAt: at, asked: { amount: "auto", since: "auto", model: "haircut" } },
  });
  const q = new URL(href, "http://x").searchParams;
  assert.equal(q.get("amount"), null);
  assert.equal(q.get("since"), null);
  assert.equal(q.get("asof"), at);
});

test("a stated run's link states both", () => {
  const href = traceHref("trace", {
    ...base,
    provenance: { generatedAt: at, asked: { amount: 1131.72, since: base.fraudDate, model: "haircut" } },
  });
  const q = new URL(href, "http://x").searchParams;
  assert.equal(q.get("amount"), "1131.72");
  assert.equal(q.get("since"), base.fraudDate);
});

test("a trace from before `asked` existed keeps the old link", () => {
  const q = new URL(traceHref("trace", { ...base, provenance: { generatedAt: at } }), "http://x").searchParams;
  assert.equal(q.get("amount"), "1131.72");
  assert.equal(q.get("since"), base.fraudDate);
});

test("a register row with a pinned run opens that run on every page", () => {
  const pin = runQuery({ amount: "auto", since: "auto", asOf: at, model: "haircut", chain: "polygon" });
  assert.equal(pin, `asof=${encodeURIComponent(at)}&chain=polygon`);
  const row = { inputAddress: "0x77fB78EAC2021Cd52097168873324d3F1200E275", chain: "polygon", pin };
  assert.equal(caseHref("freeze", row), `/freeze/0x77fB78EAC2021Cd52097168873324d3F1200E275?${pin}`);
  // Without a pin, the bare link as before.
  assert.equal(caseHref("trace", { inputAddress: base.inputAddress }), `/trace/${base.inputAddress}`);
});
