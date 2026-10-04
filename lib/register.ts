/**
 * The case register, built from what this server has actually read.
 *
 * It replaced a committed file (public/mock/cases.json) that every screen
 * rendered identically. Rows now come from three places, in this priority:
 *
 *   saved     — runs an officer put in the shared case file (lib/case-store.ts);
 *   traced    — every trace this server answered, from the hash-chained audit
 *               log (lib/audit-store.ts), the latest run per wallet;
 *   reference — the recorded wallets, re-read live by lib/reference-loop.ts and
 *               logged like any other trace.
 *
 * A recorded wallet with no live read yet (a server that has just started) is
 * listed as `recorded`, with its capture date, until its re-read lands — the
 * register never shrinks while the chain is being read, and never presents a
 * recorded row as a live one. In demo mode, which promises no network, the
 * register is the recorded set, labelled as such.
 */
import "server-only";
import { readAudit } from "./audit-store";
import { runQuery } from "./case-file";
import { loadCases } from "./case-store";
import { DEMO_MODE, frozenTraces } from "./demo";
import { actorName, isSystemActor } from "./identity";
import { referenceProgress, type ReferenceProgress } from "./reference-loop";
import type { CaseSummary, TraceResult, TriageLevel } from "./types";

export type RowOrigin = "saved" | "traced" | "reference" | "recorded";

export interface RegisterRow extends CaseSummary {
  chain: TraceResult["chain"];
  origin: RowOrigin;
  /** The moment the chain was read for this row. */
  readAt: string;
  /** Who ran it, as the audit log records it. */
  by: string | null;
  /** The query string that replays exactly this run (lib/case-file.ts `runQuery`). */
  pin?: string;
}

export interface Register {
  generatedAt: string;
  mode: "live" | "recorded";
  rows: RegisterRow[];
  reference: ReferenceProgress;
  /** Live traces in the audit log, all time. */
  tracesLogged: number;
}

/** Officers' own traces kept in the register; older ones stay in the audit log. */
const MAX_TRACED = 60;

const TRIAGE = new Set<string>(["HOT", "WARM", "COLD"]);
const CHAINS = new Set<string>(["tron", "ethereum", "polygon"]);
const key = (chain: string, address: string) => `${chain}:${address.toLowerCase()}`;

function fromTrace(t: TraceResult, origin: RowOrigin): RegisterRow {
  return {
    caseId: t.caseId,
    inputAddress: t.inputAddress,
    reportedAmountUsdt: t.reportedAmountUsdt,
    fraudDate: t.fraudDate,
    triage: t.triage,
    terminalEntity: t.terminal ? t.terminal.label.entity : null,
    chain: t.chain,
    origin,
    readAt: t.provenance.generatedAt,
    by: null,
    // The recorded run itself: answered from the case file, live or demo.
    pin: runQuery({
      amount: t.reportedAmountUsdt,
      since: t.fraudDate,
      asOf: t.provenance.generatedAt,
      model: "haircut",
      chain: t.chain,
    }),
  };
}

export async function buildRegister(): Promise<Register> {
  const generatedAt = new Date().toISOString();
  const reference = referenceProgress();
  const recorded = frozenTraces();

  if (DEMO_MODE) {
    return {
      generatedAt,
      mode: "recorded",
      rows: recorded.map((t) => fromTrace(t, "recorded")),
      reference,
      tracesLogged: 0,
    };
  }

  const [{ entries }, saved] = await Promise.all([
    readAudit().catch(() => ({ entries: [] as Awaited<ReturnType<typeof readAudit>>["entries"] })),
    loadCases().catch(() => []),
  ]);

  // The latest live run per wallet, split by who ran it.
  const latest = new Map<string, RegisterRow>();
  let tracesLogged = 0;
  for (const e of entries) {
    if (!e || e.action !== "trace" || !e.address || !e.chain || !CHAINS.has(e.chain)) continue;
    const d = e.detail;
    if (d.provenance !== "live") continue;
    tracesLogged++;
    if (typeof d.caseId !== "string" || typeof d.triage !== "string" || !TRIAGE.has(d.triage)) continue;
    const row: RegisterRow = {
      caseId: d.caseId,
      inputAddress: e.address,
      reportedAmountUsdt: typeof d.reportedAmountUsdt === "number" ? d.reportedAmountUsdt : 0,
      fraudDate: typeof d.fraudDate === "string" ? d.fraudDate : e.at,
      triage: d.triage as TriageLevel,
      terminalEntity: typeof d.exit === "string" ? d.exit : null,
      chain: e.chain as RegisterRow["chain"],
      origin: isSystemActor(e.actor) ? "reference" : "traced",
      readAt: typeof d.asOf === "string" ? d.asOf : e.at,
      by: isSystemActor(e.actor) ? null : actorName(e.actor),
      ...(typeof d.asOf === "string"
        ? { pin: runQuery({ amount: d.amount, since: d.since, asOf: d.asOf, model: d.model, chain: e.chain }) }
        : {}),
    };
    const k = key(row.chain, row.inputAddress);
    const prev = latest.get(k);
    if (!prev || row.readAt >= prev.readAt) latest.set(k, row);
  }

  const rows = new Map<string, RegisterRow>();
  // Saved runs first: an officer chose them, and they replay exactly.
  for (const c of saved) {
    rows.set(key(c.chain, c.inputAddress), {
      caseId: c.caseId,
      inputAddress: c.inputAddress,
      reportedAmountUsdt: c.reportedAmountUsdt,
      fraudDate: c.fraudDate,
      triage: c.triage,
      terminalEntity: c.terminalEntity,
      chain: c.chain,
      origin: "saved",
      readAt: c.savedAt,
      by: actorName(c.savedBy),
      pin: c.href.includes("?") ? c.href.slice(c.href.indexOf("?") + 1) : undefined,
    });
  }
  const traced = [...latest.values()]
    .filter((r) => r.origin === "traced")
    .sort((a, b) => b.readAt.localeCompare(a.readAt))
    .slice(0, MAX_TRACED);
  for (const r of [...traced, ...[...latest.values()].filter((r) => r.origin === "reference")]) {
    const k = key(r.chain, r.inputAddress);
    if (!rows.has(k)) rows.set(k, r);
  }
  // Recorded wallets not yet re-read stay listed, as recorded.
  for (const t of recorded) {
    const k = key(t.chain, t.inputAddress);
    if (!rows.has(k)) rows.set(k, fromTrace(t, "recorded"));
  }

  return { generatedAt, mode: "live", rows: [...rows.values()], reference, tracesLogged };
}
