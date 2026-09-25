import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parseDate, parseIntake } from "../lib/intake.ts";

const TRON = "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ";
const ETH = "0x77fB78EAC2021Cd52097168873324d3F1200E275";
const TX = "0x6d1ca46db9fdd124b0d317af8e9e334ecb5c9fcbb7abaeec50ad1d21886d84e3";

test("a plain list still works, and accepts transaction hashes too", () => {
  const r = parseIntake(`${TRON}\n${ETH.toLowerCase()}; ${ETH}\n${TX}\nnot-an-address`);
  assert.equal(r.sheet, false);
  assert.deepEqual(r.jobs.map((j) => [j.kind, j.input]), [
    ["address", TRON],
    ["address", ETH], // canonical spelling, the duplicate dropped
    ["tx", TX],
  ]);
  assert.equal(r.rejected.length, 1);
});

test("a complaint sheet carries acknowledgement, amount and date per row", () => {
  const csv = [
    "Ack No,Suspect wallet / txn hash,Amount (USDT),Date of fraud",
    `31609240012345,${TRON},"1,250.50",05-09-2026`,
    `31609240012346,${TX},,2026-09-06 14:30`,
    `31609240012347,${ETH},abc,05-09-2026`,
    `31609240012345,${ETH},10,05-09-2026`,
    `31609240012348,bc1qnotours,10,05-09-2026`,
  ].join("\n");
  const r = parseIntake(csv);
  assert.equal(r.sheet, true);
  assert.equal(r.jobs.length, 2);
  assert.deepEqual(r.jobs[0], {
    key: "ack:31609240012345",
    input: TRON,
    kind: "address",
    ack: "31609240012345",
    amount: 1250.5,
    fraudDate: "2026-09-04T18:30:00.000Z", // 5 Sep, 00:00 IST
  });
  assert.equal(r.jobs[1].kind, "tx");
  assert.equal(r.jobs[1].fraudDate, "2026-09-06T09:00:00.000Z"); // 14:30 IST
  assert.equal(r.rejected.length, 3); // bad amount, repeated acknowledgement, an unrecognised address
});

test("tab-separated paste from a spreadsheet", () => {
  const r = parseIntake(`Complaint number\tWallet\n9990001\t${ETH}`);
  assert.equal(r.sheet, true);
  assert.equal(r.jobs[0].ack, "9990001");
});

test("amounts and dates, read the Indian way", () => {
  assert.equal(parseAmount("12,000"), 12000);
  assert.equal(parseAmount("500 USDT"), 500);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseDate("03/04/2026"), "2026-04-02T18:30:00.000Z"); // 3 April, IST
  assert.equal(parseDate("2026-04-03T00:00:00Z"), "2026-04-03T00:00:00.000Z");
  assert.equal(parseDate("31-02-2026"), null);
  assert.equal(parseDate("yesterday"), null);
});
