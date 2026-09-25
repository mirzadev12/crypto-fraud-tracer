/**
 * Does demo mode answer every recorded case, from the file, exactly?
 *
 *   node --import ./tests/register.mjs scripts/check-demo.mjs [port]
 *
 * Against a server started with DEMO_MODE=true (default port 3000). The pitch
 * runs on demo mode (AGENTS.md §10), so this is the check that matters most on
 * the night: each case in data/demo-cases.json is requested through its own
 * permalink — the link the app builds, carrying the run's amount, window and
 * the moment it was read — and must come back
 *
 *   - stamped `x-finex-provenance: recorded` (a live answer means the file was
 *     bypassed, and offline it would fail);
 *   - for the address asked about, with the recorded disposition;
 *   - with the same findings fingerprint as the file (lib/fingerprint.ts), so
 *     every wallet, transfer, attribution and rule is the one that was frozen.
 *
 * And one address the file does not hold must NOT be answered from it — a
 * frozen case served for the wrong address is the failure demo mode exists to
 * rule out. It is a valid address that has never held USDT, so the one read
 * it causes is short, and offline it fails honestly rather than being served.
 *
 * Waits up to a minute for the server to come up, so CI can start it in the
 * background and call this straight after. Exits non-zero on any failure.
 */

import { readFileSync } from "node:fs";
import { findingsFingerprint } from "../lib/fingerprint.ts";
import { traceHref } from "../lib/api.ts";

const port = Number(process.argv[2] ?? 3000);
const BASE = `http://localhost:${port}`;
const cases = JSON.parse(readFileSync("data/demo-cases.json", "utf8")).cases;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return (await res.json()).demoMode === true;
    } catch {
      /* not yet */
    }
    await sleep(1000);
  }
  throw new Error(`no server answered on ${BASE} within a minute`);
}

let failed = 0;
const report = (ok, line) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${line}`);
};

if (!(await up())) {
  console.log(`FAIL  ${BASE} is not in demo mode (GET /api/health → demoMode false)`);
  process.exit(1);
}

for (const c of cases) {
  const recorded = c.trace;
  const href = traceHref("trace", recorded).replace(/^\/trace\//, "/api/trace/");
  const res = await fetch(BASE + href, { signal: AbortSignal.timeout(30_000) });
  const provenance = res.headers.get("x-finex-provenance");
  const body = res.ok ? await res.json() : null;
  const same =
    body &&
    body.inputAddress === recorded.inputAddress &&
    body.triage === recorded.triage &&
    findingsFingerprint(body) === findingsFingerprint(recorded);
  report(
    res.ok && provenance === "recorded" && same,
    `${recorded.chain.padEnd(8)} ${recorded.triage} ${recorded.inputAddress}` +
      (res.ok ? (provenance === "recorded" ? (same ? "" : " — answered, but not the recorded finding") : ` — provenance ${provenance}`) : ` — HTTP ${res.status}`),
  );
}

// An address the file does not hold: valid checksum, no USDT history (25 Sep 2026).
const stranger = "TY16jF4SroDe6oNZyQp7vk148CUro12dPb";
const res = await fetch(`${BASE}/api/trace/${stranger}`, { signal: AbortSignal.timeout(60_000) });
const provenance = res.headers.get("x-finex-provenance");
const answered = res.ok ? await res.json() : null;
report(
  provenance !== "recorded" && (!answered || answered.inputAddress === stranger),
  `an address the file does not hold is not answered from it (provenance ${provenance ?? "none"}, HTTP ${res.status})`,
);

console.log(`\n${cases.length + 1 - failed} of ${cases.length + 1} passed`);
process.exit(failed ? 1 : 0);
