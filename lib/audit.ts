/**
 * The audit log — the rules, kept free of files so tampering is tested on its
 * own (`tests/audit.test.mjs`).
 *
 * One entry for every trace the server answers, every case saved to or taken
 * out of the shared case file, and every browser that turns alerts on or off,
 * in the order they happened. Each entry carries the SHA-256 of the one before
 * it, so the log is a chain.
 *
 * What the chain proves: these are the entries as written, in the order
 * written. Changing, removing or reordering any one of them breaks the chain
 * at that entry, and `verifyChain` names it. What it cannot prove on its own:
 * that the whole file was not swapped for a different chain that is consistent
 * with itself, or that the server's clock was right. The first is answered by
 * writing the head hash down somewhere the server cannot reach — a case diary,
 * a covering letter — because every later log must still pass through it; the
 * page prints the head for exactly that. Who did something is recorded with how
 * far it can be trusted (`lib/identity.ts`).
 */

import { createHash } from "node:crypto";
import type { ChainName } from "./chain-client";
import { findingsFingerprint } from "./fingerprint";
import type { Actor } from "./identity";
import type { TraceResult } from "./types";

export type AuditAction = "trace" | "case.saved" | "case.removed" | "alerts.on" | "alerts.off";
export type AuditValue = string | number | boolean | null;

export interface AuditEntry {
  seq: number;
  at: string;
  actor: Actor;
  action: AuditAction;
  chain: ChainName | null;
  address: string | null;
  detail: Record<string, AuditValue>;
  /** The previous entry's hash; GENESIS for the first. */
  prev: string;
  hash: string;
}

export type AuditDraft = Pick<AuditEntry, "action" | "actor" | "chain" | "address" | "detail">;

export type ChainCheck =
  | { intact: true; entries: number; head: string }
  | { intact: false; entries: number; brokenAt: number; reason: string };

/** What a trace was asked to do, as the route received it. */
export interface TraceRun {
  amount: number | "auto";
  fraudDate: string | "auto";
  model: "haircut" | "fifo";
}

export const GENESIS = "0".repeat(64);
const ACTIONS: readonly string[] = ["trace", "case.saved", "case.removed", "alerts.on", "alerts.off"];

/** JSON with its keys in one fixed order at every depth, so an entry always hashes the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The hash of everything in an entry except its own hash. */
export function entryHash(entry: Omit<AuditEntry, "hash"> & { hash?: string }): string {
  return createHash("sha256").update(canonical({ ...entry, hash: undefined })).digest("hex");
}

export function nextEntry(prev: AuditEntry | null, draft: AuditDraft, at: string): AuditEntry {
  const body = {
    seq: prev ? prev.seq + 1 : 1,
    at,
    actor: draft.actor,
    action: draft.action,
    chain: draft.chain,
    address: draft.address,
    detail: draft.detail,
    prev: prev ? prev.hash : GENESIS,
  };
  return { ...body, hash: entryHash(body) };
}

/**
 * One line of the file, taken exactly as written — nothing is tidied, because
 * tidying would change what the hash is checked against. A line that is not an
 * entry is null, and is itself a break in the chain.
 */
export function parseEntry(line: string): AuditEntry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const actor = e.actor as Record<string, unknown> | null;
  const ok =
    Number.isInteger(e.seq) &&
    typeof e.at === "string" &&
    typeof e.action === "string" &&
    ACTIONS.includes(e.action) &&
    (e.chain === null || e.chain === "tron" || e.chain === "ethereum") &&
    (e.address === null || typeof e.address === "string") &&
    !!e.detail &&
    typeof e.detail === "object" &&
    !Array.isArray(e.detail) &&
    !!actor &&
    typeof actor === "object" &&
    (actor.id === null || typeof actor.id === "string") &&
    (actor.unit === null || typeof actor.unit === "string") &&
    typeof actor.verified === "boolean" &&
    typeof e.prev === "string" &&
    typeof e.hash === "string";
  return ok ? (v as AuditEntry) : null;
}

/** Walk the chain from the start; the first entry that does not follow is named. */
export function verifyChain(entries: (AuditEntry | null)[]): ChainCheck {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const at = i + 1;
    const e = entries[i];
    const broken = (reason: string): ChainCheck => ({ intact: false, entries: entries.length, brokenAt: at, reason });
    if (!e) return broken(`line ${at} is not an entry`);
    if (e.seq !== at) return broken(`entry ${at} is numbered ${e.seq}: an entry is missing or out of order`);
    if (e.prev !== prev) return broken(`entry ${at} does not follow the entry before it`);
    if (entryHash(e) !== e.hash) return broken(`entry ${at} has been changed since it was written`);
    prev = e.hash;
  }
  return { intact: true, entries: entries.length, head: prev };
}

/**
 * A trace as the log records it: what was asked, what the server answered,
 * and the findings fingerprint that identifies that answer. Enough to replay
 * the run exactly, and to match a packet or a saved case to it.
 */
export function traceDraft(
  actor: Actor,
  trace: TraceResult,
  run: TraceRun,
  provenance: "live" | "recorded",
): AuditDraft {
  return {
    action: "trace",
    actor,
    chain: trace.chain,
    address: trace.inputAddress,
    detail: {
      provenance,
      caseId: trace.caseId,
      triage: trace.triage,
      exit: trace.terminal ? trace.terminal.label.entity : null,
      exitKind: trace.terminal ? trace.terminal.label.kind : null,
      reportedAmountUsdt: trace.reportedAmountUsdt,
      fraudDate: trace.fraudDate,
      asOf: trace.provenance.generatedAt,
      amount: run.amount,
      since: run.fraudDate,
      model: run.model,
      wallets: trace.nodes.length,
      responses: trace.provenance.responseHashes.length,
      fingerprint: findingsFingerprint(trace),
    },
  };
}
