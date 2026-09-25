import { test } from "node:test";
import assert from "node:assert/strict";
import { poisoningSignals } from "../lib/poisoning.ts";

const t = (from, to, value) => ({ txHash: `${from}${to}${value}`, from, to, value, timestamp: 0, symbol: "USDT" });
const ME = "0xee5B5B923fFcE93A870B3104b7CA09c3db80047A";
const REAL = "0xf89d7b9c864f589bbF53a82105107622B35EaA40";
const LOOK = "0xf89D78ec88B8787d6026b2FA7E76f3BD438cAA40"; // same first and last four

test("dust from a look-alike of a real counterparty is flagged", () => {
  const s = poisoningSignals(ME, [t(REAL, ME, 100000000), t(LOOK, ME, 0.0001), t(LOOK, ME, 0.0001)]);
  assert.deepEqual(s.lookalikes, [{ lookalike: LOOK, imitates: REAL, transfers: 2 }]);
});

test("dust from an unrelated address, or a real counterparty, is not", () => {
  const s = poisoningSignals(ME, [
    t(REAL, ME, 5000),
    t("0x1234567890123456789012345678901234567890", ME, 0.5),
    t(REAL, ME, 0.2),
  ]);
  assert.equal(s.lookalikes.length, 0);
});

test("the spray counts distinct dust recipients", () => {
  const a = "0x" + "a".repeat(40);
  const b = "0x" + "b".repeat(40);
  const c = "0x" + "c".repeat(40);
  const out = [a, b, c, c].map((x) => t(ME, x, 0.001));
  const s = poisoningSignals(ME, [...out, t(ME, REAL, 50)]);
  assert.deepEqual(s.spray, { transfers: 4, recipients: 3 });
});

test("TRON look-alikes compare case-sensitively", () => {
  const me = "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ";
  const real = "TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN";
  const look = "TX1soAAAAAAAAAAAAAAAAAAAAAAAAAB2MN";
  const lower = "Tx1soAAAAAAAAAAAAAAAAAAAAAAAAAB2MN";
  const s = poisoningSignals(me, [t(me, real, 500), t(look, me, 0.01), t(lower, me, 0.01)]);
  assert.deepEqual(s.lookalikes.map((l) => l.lookalike), [look]);
});
