import { test } from "node:test";
import assert from "node:assert/strict";
import { createECDH } from "node:crypto";
import {
  MAX_ITEMS,
  MAX_SUBSCRIPTIONS,
  alertMessage,
  alertsDue,
  emptyState,
  pendingChecks,
  readState,
  readSync,
  recordRun,
  removeSubscription,
  upsert,
} from "../lib/alerts.ts";

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") };
}
const target = (n = 1) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, keys: browserKeys() });

// The recorded CRITICAL case, as the desk's watch holds it.
const RESTING = {
  address: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx",
  caseAddress: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx",
  caseId: "FX-2026-6619",
  heldUsdt: 5535.981436,
  since: "2026-09-14T08:51:02.929Z",
};
const ETH = {
  address: "0xda4E10D8B82ed53d950e2D4312A22331c515569c",
  caseAddress: "0xda4E10D8B82ed53d950e2D4312A22331c515569c",
  caseId: "FX-2026-0013",
  heldUsdt: 700,
  since: "2026-09-25T10:00:00.000Z",
};
const at = (iso) => Date.parse(iso);
const ok = { status: 201, ok: true, gone: false };

test("a browser's list is accepted only whole and well-formed", () => {
  const t = target();
  const good = readSync({ subscription: t, items: [RESTING, { ...ETH, address: ETH.address.toLowerCase() }] });
  assert.ok(!("error" in good), good.error);
  assert.equal(good.items[1].address, ETH.address, "an Ethereum address is held in its checksummed spelling");

  const bad = [
    [{ subscription: { ...t, endpoint: "https://evil.example/push" }, items: [] }, /not a browser push service/],
    [{ subscription: { ...t, keys: { ...t.keys, auth: "short" } }, items: [] }, /keys are not valid/],
    [{ subscription: t, items: [{ ...RESTING, address: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYy" }] }, /valid address/],
    [{ subscription: t, items: [{ ...RESTING, since: "yesterday" }] }, /valid address/],
    [{ subscription: t, items: [{ ...RESTING, heldUsdt: -1 }] }, /valid address/],
    [{ subscription: t, items: Array(MAX_ITEMS + 1).fill(RESTING) }, /At most/],
    [{ subscription: t }, /Expected/],
    [null, /Expected/],
  ];
  for (const [body, why] of bad) {
    const r = readSync(body);
    assert.ok("error" in r, JSON.stringify(body)?.slice(0, 80));
    assert.match(r.error, why);
  }
  const twice = readSync({ subscription: t, items: [RESTING, RESTING] });
  assert.equal(twice.items.length, 1, "a wallet listed twice is held once");
});

test("the list replaces the one held, and a wallet taken off is forgotten", () => {
  const state = emptyState();
  const t = target();
  assert.deepEqual(upsert(state, t, [RESTING, ETH], "2026-09-26T00:00:00.000Z"), { ok: true, created: true });
  state.subscriptions[0].notified[RESTING.address] = "2026-09-26T00:05:00.000Z";
  assert.deepEqual(upsert(state, t, [ETH], "2026-09-26T01:00:00.000Z"), { ok: true, created: false });
  assert.equal(state.subscriptions.length, 1);
  assert.deepEqual(state.subscriptions[0].items, [ETH]);
  assert.deepEqual(state.subscriptions[0].notified, {}, "off the watch, so put back it is watched afresh");
  assert.equal(state.subscriptions[0].createdAt, "2026-09-26T00:00:00.000Z");

  const full = emptyState();
  for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) {
    full.subscriptions.push({ ...target(i), items: [], notified: {}, createdAt: "", updatedAt: "" });
  }
  assert.equal(upsert(full, target(9999), [], "now").ok, false, "a full server refuses a new browser");
  assert.equal(upsert(full, full.subscriptions[3], [RESTING], "now").ok, true, "…but still takes a held one's list");

  assert.equal(removeSubscription(state, t.endpoint), true);
  assert.equal(removeSubscription(state, t.endpoint), false);
});

test("each wallet is asked once, from the earliest moment anyone still waiting watches it", () => {
  const state = emptyState();
  upsert(state, target(1), [RESTING, ETH], "now");
  upsert(state, target(2), [{ ...RESTING, since: "2026-09-01T00:00:00.000Z" }], "now");
  upsert(state, target(3), [ETH], "now");
  state.subscriptions[2].notified[ETH.address] = "told";
  const checks = pendingChecks(state);
  assert.deepEqual([...checks.keys()].sort(), [ETH.address, RESTING.address].sort());
  assert.equal(checks.get(RESTING.address), at("2026-09-01T00:00:00.000Z"));
  assert.equal(checks.get(ETH.address), at(ETH.since), "browser 1 still waits on it");

  state.subscriptions[0].notified[ETH.address] = "told";
  assert.equal(pendingChecks(state).has(ETH.address), false, "everyone told: not asked again");
});

test("only a read that came back, showing USDT leaving after that browser's moment, is owed an alert", () => {
  const state = emptyState();
  upsert(state, target(1), [RESTING, ETH], "now");
  upsert(state, target(2), [{ ...RESTING, since: "2026-09-20T00:00:00.000Z" }], "now");
  const reads = new Map([
    [
      RESTING.address,
      {
        complete: false,
        transfers: [
          { timestamp: at("2026-09-15T00:00:00.000Z"), value: 141362 },
          { timestamp: at("2026-09-21T00:00:00.000Z"), value: 1000 },
        ],
      },
    ],
    [ETH.address, null], // the chain did not answer
  ]);
  const due = alertsDue(state, reads);
  assert.equal(due.length, 2, "nothing for the unanswered wallet");
  const [first, second] = due;
  assert.equal(first.endpoint, target(1).endpoint);
  assert.equal(first.movedUsdt, 142362);
  assert.equal(first.transfers, 2);
  assert.equal(second.movedUsdt, 1000, "browser 2 watched from later; only what left after that counts");

  const quiet = alertsDue(state, new Map([[RESTING.address, { complete: true, transfers: [] }]]));
  assert.deepEqual(quiet, [], "still at rest is owed nothing");
});

test("the notification says it moved and when the case was read, and no more", () => {
  const m = alertMessage({ endpoint: "x", item: RESTING, movedUsdt: 142362, transfers: 2, complete: false });
  assert.equal(m.title, "Funds moved · FX-2026-6619");
  assert.equal(
    m.body,
    "TDii6v…xcqYx has sent at least 142,362.00 USDT since the case was read on 14 Sep 2026. Open the desk to see where it went.",
  );
  assert.equal(m.url, "/dashboard");
  assert.equal(m.tag, `finex-watch-${RESTING.address}`);
  assert.doesNotMatch(m.body, /fraud|proceeds|victim|stolen/i, "a wallet chosen by script is never called fraud money");
  const whole = alertMessage({ endpoint: "x", item: RESTING, movedUsdt: 5, transfers: 1, complete: true });
  assert.match(whole.body, / has sent 5\.00 USDT /);
});

test("a round's outcome: delivered is told, refused is retried, gone is dropped", () => {
  const state = emptyState();
  upsert(state, target(1), [RESTING, ETH], "now");
  upsert(state, target(2), [RESTING], "now");
  upsert(state, target(3), [RESTING], "now");
  const summary = { at: "2026-09-26T09:00:00.000Z", wallets: 2, moved: 1, unchecked: 1, sent: 1, failed: 2 };
  recordRun(
    state,
    [
      { endpoint: target(1).endpoint, address: RESTING.address, outcome: ok },
      { endpoint: target(2).endpoint, address: RESTING.address, outcome: { status: 500, ok: false, gone: false } },
      { endpoint: target(3).endpoint, address: RESTING.address, outcome: { status: 410, ok: false, gone: true } },
      { endpoint: target(9).endpoint, address: RESTING.address, outcome: ok }, // withdrawn mid-round
    ],
    summary,
  );
  assert.deepEqual(state.subscriptions.map((s) => s.endpoint), [target(1).endpoint, target(2).endpoint]);
  assert.deepEqual(state.subscriptions[0].notified, { [RESTING.address]: summary.at });
  assert.deepEqual(state.subscriptions[1].notified, {}, "refused: asked and tried again next round");
  assert.deepEqual(state.lastRun, summary);
});

test("the file is read back trusting nothing in it", () => {
  const state = emptyState();
  upsert(state, target(1), [RESTING], "2026-09-26T00:00:00.000Z");
  state.subscriptions[0].notified[RESTING.address] = "2026-09-26T00:05:00.000Z";
  state.lastRun = { at: "2026-09-26T00:05:00.000Z", wallets: 1, moved: 1, unchecked: 0, sent: 1, failed: 0 };
  const round = readState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(round, state, "what was written reads back the same");

  const damaged = JSON.parse(JSON.stringify(state));
  damaged.subscriptions.push({ endpoint: "https://evil.example/x", keys: browserKeys(), items: [] });
  damaged.subscriptions.push("nonsense");
  damaged.subscriptions[0].notified["TNotOnTheWatch11111111111111111111"] = "x";
  damaged.lastRun = { at: 5 };
  const read = readState(damaged);
  assert.equal(read.subscriptions.length, 1, "an endpoint that is not a push service is dropped");
  assert.deepEqual(Object.keys(read.subscriptions[0].notified), [RESTING.address]);
  assert.equal(read.lastRun, null);
  assert.deepEqual(readState(null), emptyState());
});
