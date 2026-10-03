import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, take } from "../lib/rate-limit.ts";

const bucket = { burst: 3, perMinute: 6 };

test("a burst is allowed, then the next request waits for a refill", () => {
  const key = `t1-${Math.random()}`;
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(take(key, bucket, t0).ok, true);
  const refused = take(key, bucket, t0);
  assert.equal(refused.ok, false);
  // 6 per minute: one token every 10 s.
  assert.equal(refused.retryAfter, 10);
  assert.equal(take(key, bucket, t0 + 10_000).ok, true);
});

test("buckets are per client and refill to the burst, never beyond", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  const t0 = 2_000_000;
  for (let i = 0; i < 3; i++) take(a, bucket, t0);
  assert.equal(take(a, bucket, t0).ok, false);
  assert.equal(take(b, bucket, t0).ok, true, "another client is unaffected");
  // An hour later the bucket holds the burst, not sixty minutes of tokens.
  const later = t0 + 3_600_000;
  for (let i = 0; i < 3; i++) assert.equal(take(a, bucket, later).ok, true);
  assert.equal(take(a, bucket, later).ok, false);
});

test("the client is the first X-Forwarded-For address, else local", () => {
  assert.equal(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientKey(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientKey(new Headers()), "local");
});
