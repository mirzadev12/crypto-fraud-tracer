import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntake } from "../lib/intake.ts";
import { NO_STATE, byState } from "../lib/by-state.ts";
import { canonicalState } from "../lib/states.ts";

test("a State column is read, spelled canonically where it names a state or UT", () => {
  const sheet = [
    "Ack No,Suspect wallet,State/UT",
    "A1,TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ,MAHARASHTRA",
    "A2,TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex,Orissa",
    "A3,TRWDtgCfXzTcMv8W6iJxh6umeqeF3zG7n5,NCT of Delhi",
    "A4,TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx,Some   District",
    "A5,TTQd8Bo1nhKEVgkKJVP3SRYZ1nDNStckvj,",
  ].join("\n");
  const { jobs, sheet: isSheet } = parseIntake(sheet);
  assert.ok(isSheet);
  assert.deepEqual(jobs.map((j) => j.stateUt), ["Maharashtra", "Odisha", "Delhi", "Some District", undefined]);
});

test("a column named Statement is not a state", () => {
  const { jobs } = parseIntake("Wallet,Statement\nTJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ,Paid on the app");
  assert.equal(jobs[0].stateUt, undefined);
});

test("aliases and abbreviations resolve; anything else does not", () => {
  assert.equal(canonicalState("J&K"), "Jammu and Kashmir");
  assert.equal(canonicalState("pondicherry"), "Puducherry");
  assert.equal(canonicalState("UP"), "Uttar Pradesh");
  assert.equal(canonicalState("tamil  nadu"), "Tamil Nadu");
  assert.equal(canonicalState("Atlantis"), null);
});

test("a batch is counted by state, most reachable money first, unstated last", () => {
  const trace = (triage, amount, entity, kind = "exchange_deposit") => ({
    triage,
    reportedAmountUsdt: amount,
    terminal: entity ? { address: "T", label: { entity, kind, confidence: 1, source: "heuristic" }, depositAddress: null } : null,
  });
  const rows = byState([
    { stateUt: "Karnataka", trace: trace("WARM", 100, "MEXC") },
    { stateUt: "Karnataka", trace: trace("WARM", 50, "MEXC") },
    { stateUt: "Karnataka", trace: trace("COLD", 900, "ISIL KHORASAN", "sanctioned") },
    { stateUt: "Karnataka", failed: true },
    { stateUt: "Delhi", trace: trace("HOT", 5000, null) },
    { trace: trace("HOT", 99999, null) },
  ]);
  assert.deepEqual(rows.map((r) => r.stateUt), ["Delhi", "Karnataka", NO_STATE]);
  const k = rows.find((r) => r.stateUt === "Karnataka");
  assert.deepEqual(
    [k.complaints, k.critical, k.reachedExchange, k.closed, k.notRead, k.reachableUsdt],
    [4, 0, 2, 1, 1, 150],
  );
  assert.deepEqual(k.exchanges, [{ entity: "MEXC", complaints: 2 }], "a sanctioned exit is not an exchange reached");
});
