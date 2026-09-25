import { test } from "node:test";
import assert from "node:assert/strict";
import { combinedHref, groupByExchange, readCombined } from "../lib/combined.ts";

const trace = (address, entity, kind = "exchange_deposit") => ({
  inputAddress: address,
  reportedAmountUsdt: 100,
  fraudDate: "2026-09-08T19:00:27.000Z",
  provenance: { generatedAt: "2026-09-14T08:51:06.859Z", responseHashes: [] },
  terminal: entity ? { address: "TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN", label: { entity, kind }, depositAddress: null } : null,
});

test("only exchanges reached by two or more complaints get a combined letter", () => {
  const groups = groupByExchange([
    { trace: trace("TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ", "MEXC") },
    { trace: trace("TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex", "MEXC"), ack: "111" },
    { trace: trace("TXncpWJZ8ZxUcwrpTP4SE4nNhZnKZM4QzC", "Bybit") },
    { trace: trace("TRWDtgCfXzTcMv8W6iJxh6umeqeF3zG7n5", "ISIL KHORASAN", "sanctioned") },
    { trace: trace("TRWDtgCfXzTcMv8W6iJxh6umeqeF3zG7n5", "ISIL KHORASAN", "sanctioned") },
    { trace: trace("TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx", null) },
  ]);
  assert.deepEqual(groups.map((g) => [g.entity, g.entries.length]), [["MEXC", 2]]);
});

test("the link carries each pinned run and reads back exactly", () => {
  const href = combinedHref("MEXC", [
    { trace: trace("TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ", "MEXC") },
    { trace: trace("TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex", "MEXC"), ack: "31609240012345" },
  ]);
  const params = new URL(href, "http://x").searchParams;
  const { entity, cases } = readCombined({ x: params.get("x"), c: params.getAll("c") });
  assert.equal(entity, "MEXC");
  assert.deepEqual(cases[1], {
    address: "TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex",
    amount: 100,
    since: "2026-09-08T19:00:27.000Z",
    asOf: "2026-09-14T08:51:06.859Z",
    ack: "31609240012345",
  });
});

test("anything malformed in the link is dropped, never trusted", () => {
  const { entity, cases } = readCombined({
    x: "<script>",
    c: ["notanaddress~5", "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ~-3~yesterday~~<b>", "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ~-3~yesterday~~<b>"],
  });
  assert.equal(entity, null);
  assert.deepEqual(cases, [{ address: "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ" }]);
});
