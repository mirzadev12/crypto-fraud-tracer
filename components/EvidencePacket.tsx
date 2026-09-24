"use client";

import Link from "next/link";
import {
  formatDateTime,
  formatDwell,
  formatPercent,
  formatUsdt,
} from "@/lib/format";
import {
  InvalidAddressState,
  NoTraceState,
  TraceSkeleton,
  useTrace,
} from "./TraceLoader";
import { DataSourceBadge, TRIAGE_META, TriageBadge, buttonStyles, kindTag } from "./ui";
import { chainMeta } from "@/lib/chain-meta";
import { FIU_SOURCE, fiuListing, fiuSentence } from "@/lib/fiu";

/**
 * The evidence packet is the one place in the product that is a document rather
 * than an instrument, and it is styled as one: serif headings, a light sheet,
 * hairline rules, no fills.
 *
 * The sheet is light even inside the dark console on purpose — what an officer
 * sees here is what comes out of the printer. Its palette is written as explicit
 * values rather than the app tokens, because the tokens are dark by design.
 */

const SHEET = {
  ink: "text-[#141412]",
  body: "text-[#4a4741]",
  faint: "text-[#75726a]",
  rule: "border-[#d9d5cb]",
  ruleSoft: "border-[#e6e2d8]",
};

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
    <section className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
      <div className="flex items-baseline gap-4">
        <span className={`font-mono text-xs tracking-[0.2em] ${SHEET.faint}`}>{n}</span>
        <h2 className={`font-document text-xl leading-tight tracking-tight ${SHEET.ink}`}>
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${SHEET.ink}`}>{children}</dd>
    </div>
  );
}

export default function EvidencePacket({
  address,
  amount,
  since,
  asOf,
}: {
  address: string;
  amount?: number;
  since?: string;
  asOf?: string;
}) {
  const { current, retry, events } = useTrace(address, { amount, since, asOf });

  if (!current) return <TraceSkeleton address={address} events={events} />;
  if (current.lookup.status === "invalid") {
    return (
      <InvalidAddressState address={current.lookup.address} reason={current.lookup.reason} />
    );
  }
  if (current.lookup.status === "unresolved") {
    return (
      <NoTraceState
        address={current.lookup.address}
        endpoint={current.lookup.endpoint}
        detail={current.lookup.detail}
        onRetry={retry}
      />
    );
  }

  const trace = current.lookup.data;
  const meta = TRIAGE_META[trace.triage];
  const terminalNode = trace.terminal
    ? trace.nodes.find((n) => n.address === trace.terminal!.address)
    : null;

  const generated = trace.provenance.generatedAt.replace(/\.\d+Z$/, "Z");
  const chain = chainMeta(trace.chain);
  // An exit at an exchange named in the FIU-IND annexure; null says nothing.
  const fiu =
    trace.terminal &&
    (trace.terminal.label.kind === "exchange_deposit" || trace.terminal.label.kind === "exchange_hot")
      ? fiuListing(trace.terminal.label.entity)
      : null;
  const caseRef = `CASE ${trace.inputAddress.slice(0, 6).toUpperCase()} · ${chain.name.toUpperCase()} · GENERATED ${generated}`;

  return (
    <div className="space-y-6">
      {/* Console chrome — stays dark, never prints. */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <DataSourceBadge
            source={current.lookup.source}
            note={current.lookup.note}
            asOf={current.lookup.asOf}
          />
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

      {/* ------------------------------------------------------------ sheet */}
      <article
        className={`fx-print-sheet mx-auto max-w-4xl  bg-[#fafaf8] p-6 md:p-10 ${SHEET.ink}`}
      >
        <header className="fx-print-block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="font-document text-xl uppercase tracking-[0.32em]">FineX</p>
            <p className={`font-mono text-xs tracking-[0.14em] ${SHEET.faint}`}>
              {caseRef}
            </p>
          </div>
          <div className={`mt-6 border-t-2 pt-6 ${SHEET.rule}`}>
            <h1 className="font-document text-4xl leading-[1.1] tracking-tight md:text-5xl">
              Cryptocurrency fund-flow
              <br />
              evidence packet
            </h1>
            <p
              className={`mt-4 font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}
            >
              {trace.caseId} · {chain.scope}
            </p>
          </div>
        </header>

        {/* 1 — subject */}
        <Section n="1" title="Subject of the complaint">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Field label="Victim-reported address">
              <code className="break-all font-mono text-sm">{trace.inputAddress}</code>
            </Field>
            <Field label="Reported amount">
              <span className="font-mono tabular-nums">
                {formatUsdt(trace.reportedAmountUsdt)}
              </span>
            </Field>
            <Field label="Date of fraud">{formatDateTime(trace.fraudDate)}</Field>
            <Field label="Wallets examined">
              <span className="font-mono tabular-nums">
                {trace.nodes.length} {trace.nodes.length === 1 ? "wallet" : "wallets"} across{" "}
                {trace.edges.length} {trace.edges.length === 1 ? "transfer" : "transfers"}
              </span>
            </Field>
          </dl>
        </Section>

        {/* 2 — finding */}
        <Section n="2" title="Finding">
          <div className={` border-l-2 pl-6 ${SHEET.rule}`}>
            <p className="font-mono text-xs uppercase tracking-[0.2em]">
              {meta.label} · {meta.action}
            </p>
            <p className={`mt-4 font-document text-lg leading-8 ${SHEET.ink}`}>
              {trace.triageReason}
            </p>
          </div>

          {trace.terminal ? (
            <>
              {trace.terminal.depositAddress ? (
                <div className={`mt-6 border-t pt-6 ${SHEET.ruleSoft}`}>
                  <p
                    className={`font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}
                  >
                    Customer deposit address
                  </p>
                  <code className="mt-2 block break-all font-mono text-xl tracking-tight md:text-2xl">
                    {trace.terminal.depositAddress}
                  </code>
                  <p className={`mt-2 text-sm ${SHEET.body}`}>
                    Held at {trace.terminal.label.entity}. This is the account the
                    exchange can act on.
                  </p>
                </div>
              ) : null}

              <dl
                className={`mt-6 grid gap-6 border-t pt-6 sm:grid-cols-2 ${SHEET.ruleSoft}`}
              >
                <Field label="Attributed entity">{trace.terminal.label.entity}</Field>
                <Field label="Attribution type">
                  {kindTag(trace.terminal.label.kind)}
                </Field>
                <Field label="Terminal address">
                  <code className="break-all font-mono text-sm">
                    {trace.terminal.address}
                  </code>
                </Field>
                <Field label="Confidence">
                  <span className="font-mono tabular-nums">
                    {formatPercent(trace.terminal.label.confidence)} (
                    {trace.terminal.label.confidence.toFixed(2)})
                  </span>
                </Field>
                <Field label="Attribution source">
                  {trace.terminal.label.source.replace(/_/g, " ")}
                </Field>
                {terminalNode ? (
                  <Field label="Victim funds reaching this address">
                    <span className="font-mono tabular-nums">
                      {formatUsdt(terminalNode.taintedValueUsdt)} (
                      {formatPercent(terminalNode.taintFraction)} of the reported
                      amount)
                    </span>
                  </Field>
                ) : null}
                {trace.terminal.label.evidence ? (
                  <div className="sm:col-span-2">
                    <Field label="Basis for attribution">
                      <span className="font-mono text-xs leading-6">
                        {trace.terminal.label.evidence}
                      </span>
                    </Field>
                  </div>
                ) : null}
                {fiu ? (
                  <div className="sm:col-span-2">
                    <Field label="Registration in India">
                      {fiuSentence(trace.terminal.label.entity, fiu)} Source: {FIU_SOURCE.url}
                    </Field>
                  </div>
                ) : null}
              </dl>
            </>
          ) : (
            <p className={`mt-6 text-sm leading-7 ${SHEET.body}`}>
              No exchange or labelled service was reached within the traced depth.{" "}
              {trace.triageReason}
            </p>
          )}
        </Section>

        {/* 3 — risk indicators */}
        <Section n="3" title="Laundering indicators">
          {trace.riskFlags.length === 0 ? (
            <p className={`text-sm ${SHEET.body}`}>
              No laundering patterns fired on this path.
            </p>
          ) : (
            <ol className="space-y-6">
              {trace.riskFlags.map((f, i) => (
                <li key={`${f.code}-${i}`} className="fx-print-block text-sm">
                  <p
                    className={`font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}
                  >
                    {f.code}
                  </p>
                  <p className={`mt-2 leading-7 ${SHEET.ink}`}>{f.reason}</p>
                  <p className={`mt-1 break-all font-mono text-xs ${SHEET.body}`}>
                    at {f.atAddress}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* 4 — path of funds */}
        <Section n="4" title="Path of funds">
          <div className="fx-scroll min-w-0 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr
                  className={`border-b ${SHEET.rule} font-mono uppercase tracking-[0.14em] ${SHEET.faint}`}
                >
                  <th className="py-2 pr-4 font-normal">From</th>
                  <th className="py-2 pr-4 font-normal">To</th>
                  <th className="py-2 pr-4 text-right font-normal">Value (USDT)</th>
                  <th className="py-2 pr-4 font-normal">Timestamp (UTC)</th>
                  <th className="py-2 pr-4 font-normal">Held</th>
                  <th className="py-2 font-normal">Transaction hash</th>
                </tr>
              </thead>
              <tbody>
                {[...trace.edges]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  )
                  .map((e, i) => (
                    <tr key={`${e.txHash}-${i}`} className={`border-b ${SHEET.ruleSoft}`}>
                      <td className="py-2 pr-4 font-mono">{e.from}</td>
                      <td className="py-2 pr-4 font-mono">{e.to}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">
                        {formatUsdt(e.valueUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 pr-4">{formatDateTime(e.timestamp)}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatDwell(e.dwellSeconds)}
                      </td>
                      <td className="break-all py-2 font-mono">{e.txHash}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5 — narrative */}
        {trace.narrative ? (
          <Section n="5" title="Summary">
            <p className={`wrap-anywhere font-document text-lg leading-8 ${SHEET.ink}`}>
              {trace.narrative}
            </p>
          </Section>
        ) : null}

        {/* 6 — custody */}
        <Section n={trace.narrative ? "6" : "5"} title="Chain of custody">
          <dl className="grid gap-6 sm:grid-cols-3">
            <Field label="API calls made">
              <span className="font-mono tabular-nums">{trace.provenance.apiCalls}</span>
            </Field>
            <Field label="Responses hashed">
              <span className="font-mono tabular-nums">
                {trace.provenance.responseHashes.length}
              </span>
            </Field>
            <Field label="Generated at">
              {formatDateTime(trace.provenance.generatedAt)}
            </Field>
          </dl>
          {trace.provenance.apiCalls > trace.provenance.responseHashes.length ? (
            <p className={`mt-6 text-sm leading-7 ${SHEET.body}`}>
              {trace.provenance.apiCalls - trace.provenance.responseHashes.length} of
              the requests were refused or timed out, returned nothing and were
              retried; only responses that arrived are hashed, and nothing in
              this packet was built from the others.
            </p>
          ) : null}
          <div className={`mt-6 border-t pt-4 ${SHEET.ruleSoft}`}>
            {trace.provenance.responseHashes.map((h, i) => (
              <p key={`${i}-${h}`} className={`break-all font-mono text-xs leading-6 ${SHEET.body}`}>
                sha256 {h}
              </p>
            ))}
          </div>
        </Section>

        {/* limitations */}
        <Section n="—" title="Limitations">
          <ul className={`space-y-2 text-sm leading-7 ${SHEET.body}`}>
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
        </Section>

        <footer className={`mt-10 border-t pt-6 ${SHEET.rule}`}>
          <p className={`font-document text-sm italic leading-6 ${SHEET.body}`}>
            Prepared by FineX from {chain.source}. This packet
            records an investigative finding and does not constitute a legal
            determination. SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C ·
            Team FineX.
          </p>
        </footer>
      </article>
    </div>
  );
}
