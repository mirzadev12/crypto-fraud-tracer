import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime } from "../lib/format.ts";

test("UTC, with IST beside it", () => {
  assert.equal(formatDateTime("2026-08-29T09:21:00.000Z"), "29 Aug 2026, 09:21 UTC · 14:51 IST");
});

test("the IST date is stated when it differs from the UTC date", () => {
  assert.equal(formatDateTime("2026-09-08T19:00:00.000Z"), "8 Sep 2026, 19:00 UTC · 9 Sep, 00:30 IST");
  assert.equal(formatDateTime("2026-12-31T20:15:00.000Z"), "31 Dec 2026, 20:15 UTC · 1 Jan 2027, 01:45 IST");
});

test("nothing to format stays a dash", () => {
  assert.equal(formatDateTime(null), "—");
  assert.equal(formatDateTime("not a date"), "—");
});
