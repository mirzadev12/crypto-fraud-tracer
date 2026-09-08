"use client";

import Link from "next/link";
import {
  formatDateTime,
  formatDwell,
  formatPercent,
  formatUsdt,
} from "@/lib/format";
import { NoTraceState, TraceSkeleton, useTrace } from "./TraceLoader";
import { DataSourceBadge, TRIAGE_META, TriageBadge, buttonStyles } from "./ui";

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tx-print-block border-t border-line pt-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-faint">
        {n} · {title}
      </h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function EvidencePacket({ address }: { address: string }) {
  const { current, retry } = useTrace(address);

  if (!current) return <TraceSkeleton />;
  if (current.status === "error") {
    return <NoTraceState address={address} message={current.message} onRetry={retry} />;
  }

  const trace = current.result.data;
  const meta = TRIAGE_META[trace.triage];
  const terminalNode = trace.terminal
    ? trace.nodes.find((n) => n.address === trace.terminal!.address)
    : null;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <DataSourceBadge source={current.result.source} note={current.result.note} />
          <TriageBadge level={trace.triage} withAction />
        </div>
        <div className="flex gap-2">
          <Link
            href={`/trace/${encodeURIComponent(trace.inputAddress)}`}
            className={buttonStyles.secondary}
          >
            Back to trace
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className={buttonStyles.primary}
          >
            Print / save as PDF
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------- sheet */}
      <article className="tx-print-sheet mx-auto max-w-4xl rounded-2xl border border-line bg-surface p-8 md:p-10">
        <header className="tx-print-block flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-lg font-bold tracking-wide">
              TRACE<span className="text-brand">X</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-faint">
              Cryptocurrency fund-flow evidence packet
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="font-mono text-sm text-ink">{trace.caseId}</p>
            <p className="mt-1">Generated {formatDateTime(trace.provenance.generatedAt)}</p>
            <p className="mt-0.5">Chain: TRON · USDT (TRC-20)</p>
          </div>
        </header>

        {/* 1 — subject */}
        <Section n="1" title="Subject of the complaint">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Victim-reported address">
              <code className="break-all font-mono text-sm">{trace.inputAddress}</code>
            </Field>
            <Field label="Reported amount">
              <span className="font-mono">{formatUsdt(trace.reportedAmountUsdt)}</span>
            </Field>
            <Field label="Date of fraud">{formatDateTime(trace.fraudDate)}</Field>
            <Field label="Wallets examined">
              <span className="font-mono">
                {trace.nodes.length} across {trace.edges.length} transfers
              </span>
            </Field>
          </dl>
        </Section>

        {/* 2 — finding */}
        <Section n="2" title="Finding">
          <div
            className={`tx-print-keep rounded-xl border p-5 ${meta.ring} bg-surface-2/50`}
          >
            <p className={`text-sm font-semibold uppercase tracking-[0.16em] ${meta.text}`}>
              {trace.triage} · {meta.action}
            </p>
            <p className="mt-3 text-sm leading-7 text-ink">{trace.triageReason}</p>
          </div>

          {trace.terminal ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Attributed entity">{trace.terminal.label.entity}</Field>
              <Field label="Attribution type">
                {trace.terminal.label.kind.replace(/_/g, " ")}
              </Field>
              <Field label="Terminal address">
                <code className="break-all font-mono text-sm">
                  {trace.terminal.address}
                </code>
              </Field>
              <Field label="Customer deposit address">
                {trace.terminal.depositAddress ? (
                  <code className="break-all font-mono text-sm">
                    {trace.terminal.depositAddress}
                  </code>
                ) : (
                  <span className="text-muted">Not applicable</span>
                )}
              </Field>
              <Field label="Confidence">
                <span className="font-mono">
                  {trace.terminal.label.confidence.toFixed(2)}
                </span>
              </Field>
              <Field label="Attribution source">
                {trace.terminal.label.source.replace(/_/g, " ")}
              </Field>
              {terminalNode ? (
                <Field label="Victim funds reaching this address">
                  <span className="font-mono">
                    {formatUsdt(terminalNode.taintedValueUsdt)} (
                    {formatPercent(terminalNode.taintFraction)} of the reported
                    amount)
                  </span>
                </Field>
              ) : null}
              {trace.terminal.label.evidence ? (
                <Field label="Basis for attribution">
                  <span className="font-mono text-xs leading-6">
                    {trace.terminal.label.evidence}
                  </span>
                </Field>
              ) : null}
            </dl>
          ) : (
            <p className="mt-5 text-sm leading-7 text-muted">
              No exchange or labelled service was reached within the traced depth.
              The funds were last observed at rest, which is recorded in section 4.
            </p>
          )}
        </Section>

        {/* 3 — risk indicators */}
        <Section n="3" title="Laundering indicators">
          {trace.riskFlags.length === 0 ? (
            <p className="text-sm text-muted">
              No laundering patterns fired on this path.
            </p>
          ) : (
            <ol className="space-y-3">
              {trace.riskFlags.map((f, i) => (
                <li key={`${f.code}-${i}`} className="tx-print-block text-sm">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
                    {f.code}
                  </p>
                  <p className="mt-1 leading-7 text-ink">{f.reason}</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-muted">
                    at {f.atAddress}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* 4 — path of funds */}
        <Section n="4" title="Path of funds">
          <div className="tx-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="py-2 pr-3 font-medium">From</th>
                  <th className="py-2 pr-3 font-medium">To</th>
                  <th className="py-2 pr-3 text-right font-medium">Value (USDT)</th>
                  <th className="py-2 pr-3 font-medium">Timestamp (UTC)</th>
                  <th className="py-2 pr-3 font-medium">Held</th>
                  <th className="py-2 font-medium">Transaction hash</th>
                </tr>
              </thead>
              <tbody>
                {[...trace.edges]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  )
                  .map((e, i) => (
                    <tr key={`${e.txHash}-${i}`} className="border-b border-line-soft">
                      <td className="py-2 pr-3 font-mono">{e.from}</td>
                      <td className="py-2 pr-3 font-mono">{e.to}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {formatUsdt(e.valueUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 pr-3">{formatDateTime(e.timestamp)}</td>
                      <td className="py-2 pr-3">{formatDwell(e.dwellSeconds)}</td>
                      <td className="py-2 font-mono break-all">{e.txHash}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5 — narrative */}
        {trace.narrative ? (
          <Section n="5" title="Summary">
            <p className="text-sm leading-7 text-muted">{trace.narrative}</p>
          </Section>
        ) : null}

        {/* 6 — custody */}
        <Section n={trace.narrative ? "6" : "5"} title="Chain of custody">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field label="API calls made">
              <span className="font-mono">{trace.provenance.apiCalls}</span>
            </Field>
            <Field label="Responses hashed">
              <span className="font-mono">{trace.provenance.responseHashes.length}</span>
            </Field>
            <Field label="Generated at">
              {formatDateTime(trace.provenance.generatedAt)}
            </Field>
          </dl>
          <div className="mt-4 space-y-1">
            {trace.provenance.responseHashes.map((h) => (
              <p key={h} className="break-all font-mono text-[10px] leading-5 text-muted">
                sha256 {h}
              </p>
            ))}
          </div>
        </Section>

        {/* limitations */}
        <section className="tx-print-block mt-8 rounded-xl border border-line bg-surface-2/50 p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-faint">
            Limitations
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-6 text-muted">
            <li>
              Attribution is an investigative lead. It is not, on its own, grounds
              for freezing an account.
            </li>
            <li>
              Exchange hot-wallet labels come from public block-explorer tags.
              Deposit-address attributions are derived by sweep-pattern clustering
              and carry the confidence stated in section 2.
            </li>
            <li>
              The trace follows a maximum depth of three hops and the five largest
              outflows per wallet. Value below one percent of the reported amount is
              not followed.
            </li>
            <li>
              Movement through a mixing service cannot be followed
              deterministically. Where a path enters one, the trace stops there and
              says so.
            </li>
          </ul>
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-[10px] leading-5 text-faint">
          <p>
            Prepared with TraceX · TRON / USDT (TRC-20) · Public blockchain data.
            SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX.
          </p>
        </footer>
      </article>
    </div>
  );
}
