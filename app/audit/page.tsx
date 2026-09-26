import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { PageHeader, TRIAGE_META, buttonStyles } from "@/components/ui";
import type { AuditEntry } from "@/lib/audit";
import { readAudit } from "@/lib/audit-store";
import { formatDateTime, shortAddress } from "@/lib/format";
import { actorBasis, actorName } from "@/lib/identity";
import type { TriageLevel } from "@/lib/types";

export const metadata: Metadata = {
  title: "Audit Log",
  description:
    "Every trace this server answered, every case saved or removed, and every browser that turned alerts on or off, in a hash chain.",
};

// Read from the server's own file on every visit; never built ahead.
export const dynamic = "force-dynamic";

const SHOWN = 200;

function triageLabel(value: unknown): string {
  return typeof value === "string" && value in TRIAGE_META
    ? TRIAGE_META[value as TriageLevel].label
    : "—";
}

/** One entry in words. Only what the entry itself holds; nothing is looked up. */
function what(e: AuditEntry): { head: string; rest: string } {
  const d = e.detail;
  switch (e.action) {
    case "trace":
      return {
        head: d.provenance === "recorded" ? "Traced · recorded" : "Traced · live",
        rest: `${triageLabel(d.triage)} · ${typeof d.exit === "string" ? d.exit : "no exit named"} · case ${String(d.caseId)} · fingerprint ${String(d.fingerprint).slice(0, 12)}…`,
      };
    case "case.saved":
      return { head: "Saved to case file", rest: `case ${String(d.caseId)}, the trace in entry ${String(d.fromEntry)}` };
    case "case.removed":
      return { head: "Removed from case file", rest: `case ${String(d.caseId)}` };
    case "alerts.on":
      return { head: "Alerts turned on", rest: `${String(d.wallets)} watched · via ${String(d.service)}` };
    case "alerts.off":
      return { head: "Alerts turned off", rest: d.service ? `via ${String(d.service)}` : "" };
  }
}

export default async function AuditPage() {
  const { entries, check } = await readAudit();
  const latest = entries
    .map((e, i) => ({ e, line: i + 1 }))
    .slice(-SHOWN)
    .reverse();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chain of custody"
        title="Audit log"
        description="Every trace this server answered, every case saved to or taken out of the case file, and every browser that turned alerts on or off — each entry carrying the SHA-256 of the one before it, so none can be changed, removed or reordered without the chain showing where."
        actions={
          entries.length ? (
            <a href="/api/audit?format=jsonl" download className={buttonStyles.secondary}>
              Download the log
            </a>
          ) : null
        }
      />

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-6">
        {!entries.length ? (
          <p className="text-muted">
            Nothing recorded yet. The first trace this server answers is entry 1.
          </p>
        ) : check.intact ? (
          <>
            <p className="font-label text-xs font-semibold uppercase tracking-[0.24em] text-confirmed">
              Chain intact · {check.entries} {check.entries === 1 ? "entry" : "entries"}
            </p>
            <p className="text-muted">
              Every entry follows the one before it and matches its own hash. The
              latest entry&rsquo;s hash — the head — is:
            </p>
            <p className="break-all font-mono text-xs text-ink">{check.head}</p>
            <p className="text-faint">
              Write the head down somewhere this server cannot reach, such as a case
              diary or a covering letter. Every later log must still pass through it,
              so a log swapped wholesale for another would not. Check a downloaded
              copy anywhere with <span className="font-mono">node scripts/verify-audit.mjs</span>,
              which uses nothing from this application.
            </p>
          </>
        ) : (
          <>
            <p className="font-label text-xs font-semibold uppercase tracking-[0.24em] text-critical">
              Chain broken at entry {check.brokenAt}
            </p>
            <p className="text-muted">
              {check.reason[0].toUpperCase() + check.reason.slice(1)}. Entries before it
              are as they were written; from it on, nothing here can be relied on as
              the record.
            </p>
          </>
        )}
        <p className="text-faint">
          Who did something is shown as the record holds it: stated at sign-in and not
          verified, unless a sign-in gateway in front of this server verified it.{" "}
          <Link href="/login" className="text-brass hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      {latest.length ? (
        <div className="fx-scroll mt-10 min-w-0 overflow-x-auto border border-line">
          <table className="w-full min-w-[760px] text-left text-xs">
            <caption className="sr-only">
              The latest {latest.length} entries, newest first
            </caption>
            <thead className="border-b border-line font-label uppercase tracking-[0.16em] text-faint">
              <tr>
                <th scope="col" className="px-4 py-4 font-medium">#</th>
                <th scope="col" className="px-4 py-4 font-medium">When (UTC)</th>
                <th scope="col" className="px-4 py-4 font-medium">Who</th>
                <th scope="col" className="px-4 py-4 font-medium">What</th>
                <th scope="col" className="px-4 py-4 font-medium">Wallet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {latest.map(({ e, line }) =>
                e ? (
                  <tr key={line} className="align-top">
                    <td className="px-4 py-4 font-mono text-faint">{e.seq}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-muted">{formatDateTime(e.at)}</td>
                    <td className="px-4 py-4 text-muted" title={actorBasis(e.actor)}>
                      {actorName(e.actor)}
                      {e.actor.id ? (
                        <span className="block text-faint">{e.actor.verified ? "verified" : "stated, not verified"}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className="block text-ink">{what(e).head}</span>
                      <span className="block text-faint">{what(e).rest}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-muted">
                      {e.address ? (
                        <Link href={`/wallet/${encodeURIComponent(e.address)}`} className="hover:text-brass">
                          {shortAddress(e.address)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={line}>
                    <td colSpan={5} className="px-4 py-4 text-critical">
                      Line {line} is not an entry.
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {entries.length > SHOWN ? (
        <p className="mt-4 text-xs text-faint">
          The latest {SHOWN} of {entries.length}. The download holds every entry.
        </p>
      ) : null}
    </AppShell>
  );
}
