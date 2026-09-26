import { test } from "node:test";
import assert from "node:assert/strict";
import { nextEntry, traceDraft } from "../lib/audit.ts";
import { MAX_CASES, addCase, caseFromEntry, readCases, runHref, sortCases } from "../lib/case-file.ts";
import demo from "../data/demo-cases.json" with { type: "json" };

const officer = { id: "I4C-2291", unit: null, verified: false };
const traceOf = (address) => demo.cases.find((c) => c.address === address).trace;
const HOT = traceOf("TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx");
const ETH_WARM = traceOf("0x77fB78EAC2021Cd52097168873324d3F1200E275");
const entryFor = (trace, run, provenance = "recorded", prev = null) =>
  nextEntry(prev, traceDraft(officer, trace, run, provenance), "2026-09-26T10:00:00.000Z");

test("a link replays exactly the run that was asked for", () => {
  assert.equal(
    runHref("TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx", {
      amount: 5535.981436,
      since: "2026-09-09T13:09:36.000Z",
      asOf: "2026-09-14T08:51:02.929Z",
      model: "haircut",
    }),
    "/trace/TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx?amount=5535.981436&since=2026-09-09T13%3A09%3A36.000Z&asof=2026-09-14T08%3A51%3A02.929Z",
  );
  assert.equal(
    runHref("TX", { amount: "auto", since: "auto", asOf: "2026-09-26T10:00:00.000Z", model: "fifo" }),
    "/trace/TX?asof=2026-09-26T10%3A00%3A00.000Z&model=fifo",
    "an automatic amount and window stay automatic; FIFO is carried",
  );
});

test("a saved case is the server's own record of the trace", () => {
  const entry = entryFor(HOT, { amount: 5535.981436, fraudDate: "2026-09-09T13:09:36.000Z", model: "haircut" });
  const saved = caseFromEntry(entry, officer, "2026-09-26T11:00:00.000Z");
  assert.deepEqual(
    {
      id: saved.id,
      caseId: saved.caseId,
      inputAddress: saved.inputAddress,
      chain: saved.chain,
      triage: saved.triage,
      terminalEntity: saved.terminalEntity,
      reportedAmountUsdt: saved.reportedAmountUsdt,
      entry: saved.entry,
      fingerprint: saved.fingerprint,
      provenance: saved.provenance,
      savedBy: saved.savedBy,
    },
    {
      id: entry.hash,
      caseId: HOT.caseId,
      inputAddress: HOT.inputAddress,
      chain: "tron",
      triage: "HOT",
      terminalEntity: null,
      reportedAmountUsdt: HOT.reportedAmountUsdt,
      entry: 1,
      fingerprint: entry.detail.fingerprint,
      provenance: "recorded",
      savedBy: officer,
    },
  );
  assert.match(saved.href, /^\/trace\/TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx\?amount=5535\.981436&since=/);

  const eth = caseFromEntry(entryFor(ETH_WARM, { amount: "auto", fraudDate: "auto", model: "haircut" }, "live"), officer, "x");
  assert.equal(eth.chain, "ethereum");
  assert.equal(eth.terminalEntity, ETH_WARM.terminal.label.entity);
  assert.equal(eth.provenance, "live");

  const notATrace = nextEntry(null, { action: "alerts.on", actor: officer, chain: null, address: null, detail: {} }, "t");
  assert.equal(caseFromEntry(notATrace, officer, "t"), null);
});

test("one answer is one case, and the file has a ceiling", () => {
  const entry = entryFor(HOT, { amount: "auto", fraudDate: "auto", model: "haircut" });
  const again = entryFor(HOT, { amount: "auto", fraudDate: "auto", model: "haircut" }, "recorded", entry);
  const cases = [];
  assert.equal(addCase(cases, caseFromEntry(entry, officer, "t1")).already, false);
  const second = addCase(cases, caseFromEntry(again, { id: "Other", unit: null, verified: false }, "t2"));
  assert.equal(second.already, true, "the same fingerprint traced twice is still one case");
  assert.equal(second.case.savedAt, "t1", "…and it keeps who saved it first");
  assert.equal(cases.length, 1);

  const full = Array.from({ length: MAX_CASES }, (_, i) => ({ ...cases[0], inputAddress: `T${i}`, id: String(i) }));
  assert.equal(addCase(full, caseFromEntry(entryFor(ETH_WARM, { amount: "auto", fraudDate: "auto", model: "haircut" }), officer, "t")).ok, false);
});

test("the case file runs like the register: critical first, then by the sum at stake", () => {
  const make = (triage, amount, date) => ({ triage, reportedAmountUsdt: amount, fraudDate: date });
  const order = sortCases([
    make("COLD", 90_000, "2026-09-01T00:00:00Z"),
    make("WARM", 10, "2026-09-01T00:00:00Z"),
    make("HOT", 5, "2026-09-01T00:00:00Z"),
    make("WARM", 500, "2026-08-01T00:00:00Z"),
    make("WARM", 500, "2026-09-10T00:00:00Z"),
  ]).map((c) => `${c.triage}:${c.reportedAmountUsdt}:${c.fraudDate.slice(5, 10)}`);
  assert.deepEqual(order, ["HOT:5:09-01", "WARM:500:09-10", "WARM:500:08-01", "WARM:10:09-01", "COLD:90000:09-01"]);
});

test("the file is read back trusting nothing in it", () => {
  const good = caseFromEntry(entryFor(HOT, { amount: "auto", fraudDate: "auto", model: "haircut" }), officer, "t");
  const round = readCases(JSON.parse(JSON.stringify([good])));
  assert.deepEqual(round, [good]);
  assert.deepEqual(readCases([{ ...good, href: "https://elsewhere.example/" }]), [], "a link out of the app is never kept");
  assert.deepEqual(readCases([{ ...good, triage: "LUKEWARM" }]), []);
  assert.deepEqual(readCases([{ ...good, savedBy: { id: "  I4C\n-7  ", verified: true } }])[0].savedBy, {
    id: "I4C -7",
    unit: null,
    verified: true,
  });
  assert.deepEqual(readCases("nonsense"), []);
});
