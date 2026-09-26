/**
 * The audit log on disk: `audit.jsonl` in the state directory
 * (`lib/state-file.ts`), one entry per line, appended and never rewritten.
 *
 * Recording is deliberately best effort for traces: a trace that was answered
 * is never withheld from an officer because the log could not be written. The
 * failure goes to the server's own log, and the missing entry shows as
 * missing — a saved case can only be made from a trace the log holds.
 *
 * Server-only.
 */

import { stat } from "node:fs/promises";
import {
  nextEntry,
  parseEntry,
  traceDraft,
  verifyChain,
  type AuditDraft,
  type AuditEntry,
  type ChainCheck,
  type TraceRun,
} from "./audit";
import { actorOf } from "./identity";
import { appendStateFile, readStateFile, serially, stateFile } from "./state-file";
import type { TraceResult } from "./types";

const FILE = "audit.jsonl";

/** The last entry written, and the file size it was written at, so an append need not re-read the log. */
interface Tail {
  entry: AuditEntry | null;
  size: number;
}
const holder = globalThis as typeof globalThis & { __finexAuditTail?: Tail };

async function fileSize(): Promise<number> {
  try {
    return (await stat(stateFile(FILE))).size;
  } catch {
    return 0;
  }
}

export async function readAudit(): Promise<{ entries: (AuditEntry | null)[]; check: ChainCheck }> {
  const text = (await readStateFile(FILE)) ?? "";
  const entries = text
    .split("\n")
    .filter((line) => line.trim())
    .map(parseEntry);
  return { entries, check: verifyChain(entries) };
}

/** The raw file, exactly as written, for checking elsewhere (`scripts/verify-audit.mjs`). */
export async function auditText(): Promise<string> {
  return (await readStateFile(FILE)) ?? "";
}

/** Append one entry after the last one written. One at a time. */
export function appendAudit(draft: AuditDraft): Promise<AuditEntry> {
  return serially(FILE, async () => {
    const size = await fileSize();
    let tail = holder.__finexAuditTail;
    if (!tail || tail.size !== size) {
      // First append since start, or the file changed under us: read what is really there.
      const { entries } = await readAudit();
      tail = { entry: entries.length ? entries[entries.length - 1] : null, size };
    }
    const entry = nextEntry(tail.entry, draft, new Date().toISOString());
    const line = JSON.stringify(entry) + "\n";
    await appendStateFile(FILE, line);
    holder.__finexAuditTail = { entry, size: size + Buffer.byteLength(line) };
    return entry;
  });
}

/** Record a trace the server has just answered. Never throws. */
export async function recordTrace(
  request: Request,
  trace: TraceResult,
  run: TraceRun,
  provenance: "live" | "recorded",
): Promise<void> {
  try {
    await appendAudit(traceDraft(actorOf(request.headers), trace, run, provenance));
  } catch (err) {
    console.error("[audit] a trace could not be recorded:", err instanceof Error ? err.message : err);
  }
}

/**
 * The latest trace the log holds for exactly this answer — the address and the
 * findings fingerprint — or null. What a saved case is made from.
 */
export async function findTrace(address: string, fingerprint: string): Promise<AuditEntry | null> {
  const { entries } = await readAudit();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e && e.action === "trace" && e.address === address && e.detail.fingerprint === fingerprint) return e;
  }
  return null;
}
