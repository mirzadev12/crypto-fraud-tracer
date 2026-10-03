import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInr, formatRate, groupIndian } from "../lib/inr-format.ts";

test("Indian digit grouping: three, then pairs", () => {
  assert.equal(groupIndian(0), "0");
  assert.equal(groupIndian(999), "999");
  assert.equal(groupIndian(1000), "1,000");
  assert.equal(groupIndian(48250), "48,250");
  assert.equal(groupIndian(99999), "99,999");
  assert.equal(groupIndian(1234567), "12,34,567");
  assert.equal(groupIndian(123456789), "12,34,56,789");
});

test("lakh and crore above a lakh, rupees below", () => {
  assert.equal(formatInr(48250), "₹48,250");
  assert.equal(formatInr(99999.4), "₹99,999");
  assert.equal(formatInr(100000), "₹1.00 lakh");
  assert.equal(formatInr(372000), "₹3.72 lakh");
  assert.equal(formatInr(9999999), "₹100.00 lakh");
  assert.equal(formatInr(21400000), "₹2.14 crore");
  assert.equal(formatInr(Number.NaN), "—");
});

test("the rate to the paisa", () => {
  assert.equal(formatRate(99.52), "₹99.52");
  assert.equal(formatRate(100), "₹100.00");
});
