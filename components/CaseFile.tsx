"use client";

/**
 * The shared case file on the Case queue: runs officers saved on this server,
 * for every officer using it. The register below it is committed and the same
 * everywhere; this is the part that belongs to this deployment.
 *
 * Each row is the run the server itself traced (`lib/case-file.ts`), so its
 * disposition and figures are the server's, and "Open" replays exactly that
 * run. Who saved it is shown with how far that name can be trusted.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import AddressChip from "@/components/AddressChip";
import { Panel, TriageBadge } from "@/components/ui";
import type { SavedCase } from "@/lib/case-file";
import { listCases, removeCase } from "@/lib/cases-client";
import { formatDateTime, formatUsdt } from "@/lib/format";
import { actorBasis, actorName } from "@/lib/identity";

type Reading = { ok: true; cases: SavedCase[] } | { ok: false; error: string };

const QUIET =
  "fx-option-quiet shrink-0 px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass disabled:opacity-60";
const OPTION =
  "fx-option shrink-0 px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass";

export default function CaseFile() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listCases().then((r) => {
      if (live) setReading(r);
    });
    return () => {
      live = false;
    };
  }, []);

  const remove = async (id: string) => {
    setRemoving(id);
    await removeCase(id);
    setReading(await listCases());
    setRemoving(null);
  };

  const line = (text: string, withLog = false) => (
    <p
      id="case-file"
      className="fx-anchor flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-4 text-xs leading-5 text-faint"
    >
      <span className="font-label font-semibold uppercase tracking-[0.24em] text-muted">Case file</span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <span>{text}</span>
      {withLog ? (
        <Link href="/audit" className="text-brass hover:underline">
          Audit log
        </Link>
      ) : null}
    </p>
  );

  if (!reading) return line("Reading…");
  if (!reading.ok) return line(`Not available: ${reading.error}.`);
  if (!reading.cases.length) {
    return line(
      "Nothing saved on this server yet. Open a case and press Save case: every officer using this server then sees it here.",
      true,
    );
  }

  return (
    <div id="case-file" className="fx-anchor">
      <Panel
        title={`Case file · ${reading.cases.length} saved`}
        subtitle="Saved on this server, for every officer using it. Each is the run the server itself traced; opening it replays that run exactly."
        framed={false}
        actions={
          <Link href="/audit" className={QUIET}>
            Audit log
          </Link>
        }
      >
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {reading.cases.map((c) => (
            <li key={c.id} className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <TriageBadge level={c.triage} />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-faint">{c.caseId}</span>
                <AddressChip address={c.inputAddress} quiet />
                <span className="text-xs text-muted">
                  {c.terminalEntity ?? "No exit named"} · {formatUsdt(c.reportedAmountUsdt, { symbol: false })} USDT
                </span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-xs leading-5 text-faint" title={actorBasis(c.savedBy)}>
                  Saved by {actorName(c.savedBy)}
                  {c.savedBy.id ? (c.savedBy.verified ? " (verified)" : " (stated)") : ""} · {formatDateTime(c.savedAt)}
                </span>
                <Link href={c.href} className={OPTION}>
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  disabled={removing === c.id}
                  className={QUIET}
                >
                  {removing === c.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
