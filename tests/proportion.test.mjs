import { test } from "node:test";
import assert from "node:assert/strict";
import { accountShare } from "../lib/proportion.ts";

const read = (receivedUsdt, payers, historyComplete = true) => ({ readable: true, historyComplete, receivedUsdt, payers });

test("a small share is stated as most of the account not being this case's", () => {
  const s = accountShare(1131.72, read(18240, 41));
  assert.equal(s.state, "computed");
  assert.match(s.sentence, /6\.2% of that\. Most of what it received is not from this case\./);
  assert.match(s.sentence, /from 41 payers/);
});

test("a partial history gives an upper bound, never a share", () => {
  const s = accountShare(500, read(1000, 3, false));
  assert.equal(s.state, "upper-bound");
  assert.match(s.sentence, /at least 1,000 USDT/);
  assert.match(s.sentence, /at most 50%/);
});

test("an unread account, or a read that proves itself short, computes nothing", () => {
  assert.equal(accountShare(10, null).state, "not-computed");
  assert.equal(accountShare(10, { readable: false, historyComplete: false, receivedUsdt: 0 }).state, "not-computed");
  // More traced into it than it is read as receiving: the read is short.
  assert.equal(accountShare(2000, read(500, 2)).state, "not-computed");
});
