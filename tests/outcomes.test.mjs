import { test } from "node:test";
import assert from "node:assert/strict";
import { byExchange, mergeOutcomes, outcomeKey, outcomesCsv, readOutcome } from "../lib/outcomes.ts";

const base = {
  chain: "tron",
  caseId: "FX-2026-0001",
  address: "TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex",
  exchange: "MEXC",
  account: "TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN",
  tracedUsdt: 1000,
  href: "/freeze/TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex?asof=2026-09-14T08%3A51%3A06.859Z",
  status: "sent",
  updatedAt: "2026-09-25T10:00:00.000Z",
};
const rec = (over) => readOutcome({ ...base, ...over });

test("a stored or imported record is read only when it is one", () => {
  assert.ok(rec({}));
  assert.equal(rec({ status: "maybe" }), null, "unknown status");
  assert.equal(rec({ href: "https://elsewhere.example/freeze/x" }), null, "a link out of the app is never stored");
  assert.equal(rec({ exchange: "" }), null);
  const r = rec({ sentOn: "25-09-2026", frozenUsdt: -5, note: "  seen  " });
  assert.equal(r.sentOn, undefined, "dates are YYYY-MM-DD or dropped");
  assert.equal(r.frozenUsdt, undefined, "a negative amount is dropped");
  assert.equal(r.note, "seen");
});

test("merging keeps one record per request, the later update winning", () => {
  const early = rec({ status: "sent" });
  const later = rec({ status: "frozen", updatedAt: "2026-09-26T10:00:00.000Z" });
  const other = rec({ account: "TOtherAccount1111111111111111111111", updatedAt: "2026-09-20T00:00:00.000Z" });
  const merged = mergeOutcomes([later, other], [early]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((o) => outcomeKey(o) === outcomeKey(base)).status, "frozen");
  assert.equal(merged[0].status, "frozen", "latest first");
});

test("each exchange is counted from its records only", () => {
  const rows = byExchange([
    rec({ account: "A1", status: "frozen", sentOn: "2026-09-01", answeredOn: "2026-09-03", frozenUsdt: 400 }),
    rec({ account: "A2", status: "refused", sentOn: "2026-09-01", answeredOn: "2026-09-11" }),
    rec({ account: "A3", status: "partly-frozen", sentOn: "2026-09-05", answeredOn: "2026-09-09", frozenUsdt: 100 }),
    rec({ account: "A4", status: "no-response", sentOn: "2026-09-01" }),
    rec({ account: "A5", status: "sent" }),
    rec({ account: "B1", exchange: "Binance", status: "acknowledged", sentOn: "2026-09-10", answeredOn: "2026-09-10" }),
  ]);
  const mexc = rows.find((r) => r.exchange === "MEXC");
  assert.equal(mexc.requests, 5);
  assert.equal(mexc.frozen, 2);
  assert.equal(mexc.refused, 1);
  assert.equal(mexc.unanswered, 2);
  assert.equal(mexc.medianDays, 4, "median of 2, 10 and 4 days");
  assert.equal(mexc.daysMeasured, 3);
  assert.equal(mexc.frozenUsdt, 500);
  assert.equal(mexc.tracedUsdt, 5000);
  assert.equal(rows[0].exchange, "MEXC", "most requests first");
  assert.equal(rows.find((r) => r.exchange === "Binance").medianDays, 0);
});

test("the spreadsheet quotes what needs quoting", () => {
  const csv = outcomesCsv([rec({ note: 'Asked for "30 days", then more', reference: "R-1,2" })]);
  const [head, row] = csv.trim().split("\n");
  assert.ok(head.startsWith("ncrp_acknowledgement,case,chain"));
  assert.ok(row.includes('"Asked for ""30 days"", then more"'));
  assert.ok(row.includes('"R-1,2"'));
  assert.ok(row.includes("Sent, awaiting answer"));
});
