import { test } from "node:test";
import assert from "node:assert/strict";
import { NOBODY, actorBasis, actorName, actorOf, cleanName } from "../lib/identity.ts";

const headers = (h) => new Headers(h);

function withGateway(value, run) {
  const before = process.env.FINEX_IDENTITY_HEADER;
  if (value === undefined) delete process.env.FINEX_IDENTITY_HEADER;
  else process.env.FINEX_IDENTITY_HEADER = value;
  try {
    run();
  } finally {
    if (before === undefined) delete process.env.FINEX_IDENTITY_HEADER;
    else process.env.FINEX_IDENTITY_HEADER = before;
  }
}

test("without a gateway, the name typed at sign-in is recorded as stated, not verified", () => {
  withGateway(undefined, () => {
    const a = actorOf(
      headers({
        "x-finex-officer": encodeURIComponent("I4C-2291"),
        "x-finex-unit": encodeURIComponent("साइबर अपराध प्रकोष्ठ, पटना"),
      }),
    );
    assert.deepEqual(a, { id: "I4C-2291", unit: "साइबर अपराध प्रकोष्ठ, पटना", verified: false });
    assert.equal(actorName(a), "I4C-2291 · साइबर अपराध प्रकोष्ठ, पटना");
    assert.equal(actorBasis(a), "stated at sign-in, not verified");
    assert.deepEqual(actorOf(headers({})), NOBODY);
    assert.equal(actorName(NOBODY), "Not signed in");
  });
});

test("behind a gateway, only the gateway's header counts", () => {
  withGateway("X-Forwarded-Email", () => {
    const via = actorOf(headers({ "x-forwarded-email": "officer@cybercell.gov.in", "x-finex-officer": "Someone" }));
    assert.deepEqual(via, { id: "officer@cybercell.gov.in", unit: null, verified: true });
    assert.equal(actorBasis(via), "verified by the sign-in gateway");
    // Configured, but the request did not come through it: what the browser says is not taken instead.
    assert.deepEqual(actorOf(headers({ "x-finex-officer": "I4C-2291" })), NOBODY);
  });
});

test("a name cannot carry a line break, and is bounded", () => {
  assert.equal(cleanName("I4C-1\n{\"forged\":true}"), 'I4C-1 {"forged":true}');
  assert.equal(cleanName("   "), null);
  assert.equal(cleanName("%E0%A4"), "%E0%A4", "a broken encoding is taken as typed, not thrown on");
  assert.equal(cleanName("x".repeat(500)).length, 80);
});
