/**
 * The shared case file — the rules, kept free of files (`tests/case-file.test.mjs`).
 *
 * The committed register (`public/mock/cases.json`) is the same for everyone
 * and never changes. This is the other half: runs officers traced on this
 * server and chose to keep, visible to every officer who opens the same
 * server's Case queue.
 *
 * **A saved case is made from the server's own record, never from what a
 * browser sends.** The browser names a run — its address and its findings
 * fingerprint — and the server looks for the trace it recorded with that
 * fingerprint in its audit log (`lib/audit-store.ts`). Only a run this server
 * actually traced can be saved, and the disposition, exit and amounts shown for
 * it are the ones the server computed. Opening a saved case replays that exact
 * run: the same amount and window, the chain as it stood when it was read.
 *
 * This is also what `GET /api/cases` in AGENTS.md §5 always asked for — a
 * `CaseSummary[]` — and it stayed unbuilt until there was a record honest
 * enough to serve through it.
 */

import type { AuditEntry } from "./audit";
import type { ChainName } from "./chain-client";
import { readActor, type Actor } from "./identity";
import type { CaseSummary, TriageLevel } from "./types";

export interface SavedCase extends CaseSummary {
  /** The hash of the audit entry recording the trace: unique to that answer. */
  id: string;
  chain: ChainName;
  /** The audit entry this case was saved from. */
  entry: number;
  fingerprint: string;
  provenance: "live" | "recorded";
  savedAt: string;
  savedBy: Actor;
  /** The exact run: opening it replays the trace as the server read it. */
  href: string;
}

export const MAX_CASES = 500;

const TRIAGE: readonly TriageLevel[] = ["HOT", "WARM", "COLD"];

/** `/trace/…` for exactly this run. An automatic amount or window stays automatic. */
export function runHref(
  address: string,
  run: { amount: unknown; since: unknown; asOf: string; model: unknown },
): string {
  const q = new URLSearchParams();
  if (typeof run.amount === "number" && run.amount > 0) q.set("amount", String(run.amount));
  if (typeof run.since === "string" && run.since !== "auto") q.set("since", run.since);
  q.set("asof", run.asOf);
  if (run.model === "fifo") q.set("model", "fifo");
  return `/trace/${encodeURIComponent(address)}?${q}`;
}

/** The saved case for a recorded trace, or null when the entry is not a usable trace. */
export function caseFromEntry(entry: AuditEntry, savedBy: Actor, savedAt: string): SavedCase | null {
  const d = entry.detail;
  if (
    entry.action !== "trace" ||
    !entry.address ||
    !entry.chain ||
    typeof d.caseId !== "string" ||
    typeof d.triage !== "string" ||
    !TRIAGE.includes(d.triage as TriageLevel) ||
    typeof d.reportedAmountUsdt !== "number" ||
    typeof d.fraudDate !== "string" ||
    typeof d.asOf !== "string" ||
    typeof d.fingerprint !== "string" ||
    (d.provenance !== "live" && d.provenance !== "recorded")
  ) {
    return null;
  }
  return {
    id: entry.hash,
    caseId: d.caseId,
    inputAddress: entry.address,
    chain: entry.chain,
    reportedAmountUsdt: d.reportedAmountUsdt,
    fraudDate: d.fraudDate,
    triage: d.triage as TriageLevel,
    terminalEntity: typeof d.exit === "string" ? d.exit : null,
    entry: entry.seq,
    fingerprint: d.fingerprint,
    provenance: d.provenance,
    savedAt,
    savedBy,
    href: runHref(entry.address, { amount: d.amount, since: d.since, asOf: d.asOf, model: d.model }),
  };
}

/** One answer is one case: saving the same run twice keeps the first. */
export function addCase(
  cases: SavedCase[],
  saved: SavedCase,
): { ok: true; already: boolean; case: SavedCase } | { ok: false; error: string } {
  const held = cases.find((c) => c.inputAddress === saved.inputAddress && c.fingerprint === saved.fingerprint);
  if (held) return { ok: true, already: true, case: held };
  if (cases.length >= MAX_CASES) return { ok: false, error: "The case file is full." };
  cases.push(saved);
  return { ok: true, already: false, case: saved };
}

/**
 * The same order as the register: what can still be done first — CRITICAL,
 * then SUSPICIOUS, then CLOSED — and within each the largest sum at stake, then
 * the most recent fraud.
 */
export function sortCases(cases: SavedCase[]): SavedCase[] {
  return [...cases].sort(
    (a, b) =>
      TRIAGE.indexOf(a.triage) - TRIAGE.indexOf(b.triage) ||
      b.reportedAmountUsdt - a.reportedAmountUsdt ||
      Date.parse(b.fraudDate) - Date.parse(a.fraudDate),
  );
}

/** The file as read back, trusting nothing in it. */
export function readCases(value: unknown): SavedCase[] {
  if (!Array.isArray(value)) return [];
  const out: SavedCase[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      typeof c.caseId !== "string" ||
      typeof c.inputAddress !== "string" ||
      (c.chain !== "tron" && c.chain !== "ethereum") ||
      typeof c.reportedAmountUsdt !== "number" ||
      typeof c.fraudDate !== "string" ||
      typeof c.triage !== "string" ||
      !TRIAGE.includes(c.triage as TriageLevel) ||
      (c.terminalEntity !== null && typeof c.terminalEntity !== "string") ||
      !Number.isInteger(c.entry) ||
      typeof c.fingerprint !== "string" ||
      (c.provenance !== "live" && c.provenance !== "recorded") ||
      typeof c.savedAt !== "string" ||
      typeof c.href !== "string" ||
      !c.href.startsWith("/trace/")
    ) {
      continue;
    }
    out.push({
      id: c.id,
      caseId: c.caseId,
      inputAddress: c.inputAddress,
      chain: c.chain,
      reportedAmountUsdt: c.reportedAmountUsdt,
      fraudDate: c.fraudDate,
      triage: c.triage as TriageLevel,
      terminalEntity: c.terminalEntity as string | null,
      entry: c.entry as number,
      fingerprint: c.fingerprint,
      provenance: c.provenance,
      savedAt: c.savedAt,
      savedBy: readActor(c.savedBy),
      href: c.href,
    });
  }
  return out;
}
