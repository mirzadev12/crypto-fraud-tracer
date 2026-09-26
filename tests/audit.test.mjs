import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENESIS,
  canonical,
  entryHash,
  nextEntry,
  parseEntry,
  traceDraft,
  verifyChain,
} from "../lib/audit.ts";
import { findingsFingerprint } from "../lib/fingerprint.ts";
import demo from "../data/demo-cases.json" with { type: "json" };

const officer = { id: "I4C-2291", unit: "Cyber Crime Cell, Bengaluru", verified: false };
const nobody = { id: null, unit: null, verified: false };
const recorded = demo.cases.find((c) => c.address === "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx").trace;

function chainOf(n) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    const draft =
      i % 2 === 0
        ? traceDraft(officer, recorded, { amount: "auto", fraudDate: "auto", model: "haircut" }, "recorded")
        : { action: "case.saved", actor: nobody, chain: "tron", address: recorded.inputAddress, detail: { caseId: recorded.caseId, fromEntry: i } };
    entries.push(nextEntry(entries.at(-1) ?? null, draft, `2026-09-26T10:0${i}:00.000Z`));
  }
  return entries;
}
const asLines = (entries) => entries.map((e) => JSON.stringify(e));
const reread = (lines) => lines.map(parseEntry);

test("canonical JSON sorts keys at every depth and drops only undefined", () => {
  assert.equal(canonical({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null }, u: undefined }), '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
});

test("each entry names the one before it and hashes everything but its own hash", () => {
  const [a, b, c] = chainOf(3);
  assert.deepEqual([a.seq, b.seq, c.seq], [1, 2, 3]);
  assert.equal(a.prev, GENESIS);
  assert.equal(b.prev, a.hash);
  assert.equal(c.prev, b.hash);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.equal(entryHash(b), b.hash);
  assert.equal(entryHash({ ...b, hash: "anything" }), b.hash, "the stored hash is never part of what is hashed");
});

test("a trace entry records the run and the server's own answer, fingerprint included", () => {
  const [a] = chainOf(1);
  assert.equal(a.action, "trace");
  assert.equal(a.address, recorded.inputAddress);
  assert.equal(a.chain, "tron");
  assert.deepEqual(a.actor, officer);
  assert.equal(a.detail.provenance, "recorded");
  assert.equal(a.detail.triage, recorded.triage);
  assert.equal(a.detail.caseId, recorded.caseId);
  assert.equal(a.detail.asOf, recorded.provenance.generatedAt);
  assert.equal(a.detail.fingerprint, findingsFingerprint(recorded));
  assert.equal(a.detail.amount, "auto");
  assert.equal(a.detail.responses, recorded.provenance.responseHashes.length);
});

test("an intact chain verifies, read back from its lines, and names its head", () => {
  const entries = chainOf(5);
  const check = verifyChain(reread(asLines(entries)));
  assert.deepEqual(check, { intact: true, entries: 5, head: entries[4].hash });
  assert.deepEqual(verifyChain([]), { intact: true, entries: 0, head: GENESIS });
});

test("changing, removing, reordering or garbling any entry breaks the chain there", () => {
  const lines = asLines(chainOf(5));

  const changed = [...lines];
  const e = JSON.parse(changed[2]);
  e.detail.caseId = "FX-2026-9999";
  changed[2] = JSON.stringify(e);
  assert.deepEqual(verifyChain(reread(changed)), {
    intact: false,
    entries: 5,
    brokenAt: 3,
    reason: "entry 3 has been changed since it was written",
  });

  const reworded = [...lines];
  const w = JSON.parse(reworded[0]);
  w.actor.id = "Someone Else";
  reworded[0] = JSON.stringify(w);
  assert.equal(verifyChain(reread(reworded)).brokenAt, 1, "who did it is covered too");

  const removed = lines.filter((_, i) => i !== 1);
  assert.match(verifyChain(reread(removed)).reason, /entry 2 is numbered 3/);

  const swapped = [lines[0], lines[2], lines[1], lines[3], lines[4]];
  assert.equal(verifyChain(reread(swapped)).brokenAt, 2);

  const garbled = [...lines];
  garbled[3] = "{not json";
  assert.deepEqual(verifyChain(reread(garbled)).reason, "line 4 is not an entry");

  // An entry rebuilt with a fresh hash still does not follow the next one.
  const rehashed = [...lines];
  const r = JSON.parse(rehashed[1]);
  r.detail.caseId = "FX-2026-9999";
  r.hash = entryHash(r);
  rehashed[1] = JSON.stringify(r);
  assert.match(verifyChain(reread(rehashed)).reason, /entry 3 does not follow/);
});

test("the stand-alone verifier, which imports nothing from the app, agrees", () => {
  const script = fileURLToPath(new URL("../scripts/verify-audit.mjs", import.meta.url));
  const dir = mkdtempSync(path.join(tmpdir(), "finex-audit-"));
  try {
    const entries = chainOf(4);
    const file = path.join(dir, "audit.jsonl");
    writeFileSync(file, asLines(entries).join("\n") + "\n");
    const ok = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^INTACT: 4 entries/m);
    assert.match(ok.stdout, new RegExp(`^head ${entries[3].hash}$`, "m"));

    const lines = asLines(entries);
    const e = JSON.parse(lines[1]);
    e.detail.fromEntry = 99;
    lines[1] = JSON.stringify(e);
    writeFileSync(file, lines.join("\n") + "\n");
    const bad = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /BROKEN at entry 2: it has been changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
