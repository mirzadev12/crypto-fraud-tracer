"use client";

import Link from "next/link";
import { traceHref, type DataSource } from "@/lib/api";
import { chainMeta } from "@/lib/chain-meta";
import { checkHref, findingsFingerprint } from "@/lib/fingerprint";
import { formatDateTime, formatPercent, formatUsdt } from "@/lib/format";
import { typologyLabel, type TypologyId } from "@/lib/typology";
import type { TraceResult } from "@/lib/types";
import type { WatchItem } from "@/lib/watch";
import IssuerFreeze from "./IssuerFreeze";
import LegalBasisPicker from "./LegalBasisPicker";
import { FingerprintBlock } from "./PacketFingerprint";
import SendingGuide from "./SendingGuide";
import { Blank, Field, SHEET, Section } from "./sheet";
import { buttonStyles } from "./ui";

/**
 * A request to the issuer of USDT, for money at rest in a wallet nobody can
 * name. With no exchange on the trail there is no account to restrain, and the
 * issuer is the one party that can still stop the USDT moving: Tether can
 * freeze an address, and its contract records it (lib/issuer.ts reads that).
 *
 * The same two rules as the freeze request it sits beside: it is a draft for
 * an authorised officer to complete and sign, and it asserts no legal basis.
 * And one of its own: where to send it is not invented. Tether's pages publish
 * no channel for freeze requests, so the guide above the letter says exactly
 * that, with the pages that were read (data/le-contacts.json).
 */
export default function IssuerRequest({
  trace,
  resting,
  source,
  given,
  ack,
  typology,
}: {
  trace: TraceResult;
  /** The wallet holding the money, as the watch names it (lib/watch.ts). */
  resting: WatchItem;
  source: DataSource;
  given: { amount?: number; since?: string; asOf?: string };
  ack?: string;
  typology?: TypologyId;
}) {
  const chain = chainMeta(trace.chain);
  const node = trace.nodes.find((n) => n.address === resting.address);
  const generated = trace.provenance.generatedAt.replace(/\.\d+Z$/, "Z");
  const caseRef = `CASE ${trace.caseId} · ${chain.name.toUpperCase()} · GENERATED ${generated}`;
  const fingerprint = findingsFingerprint(trace);

  return (
    <div className="fx-fade space-y-6">
      {/* Console chrome — stays dark, never prints. */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-faint">No exchange on this trail: the request goes to the issuer of USDT.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={traceHref("trace", trace, ack, typology)} className={buttonStyles.secondary}>
            Back to trace
          </Link>
          <button type="button" onClick={() => window.print()} className={buttonStyles.primary}>
            Print / save as PDF
          </button>
        </div>
      </div>

      {/* Whether the issuer has already acted, read from the contract now. */}
      <div className="print:hidden">
        <IssuerFreeze address={resting.address} chain={trace.chain} />
      </div>

      {/* Where to send it: recorded as not found, with the reason. */}
      <SendingGuide exchange="Tether" />

      <article className={`fx-print-sheet mx-auto max-w-4xl bg-[#fafaf8] p-6 md:p-10 ${SHEET.ink}`}>
        <header className="fx-print-block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="font-document text-xl uppercase tracking-[0.32em]">FineX</p>
            <p className={`font-mono text-xs tracking-[0.14em] ${SHEET.faint}`}>{caseRef}</p>
          </div>
          <div className={`mt-6 border-t-2 pt-6 ${SHEET.rule}`}>
            <h1 className="font-document text-4xl leading-[1.1] tracking-tight md:text-5xl">
              Request to freeze
              <br />
              USDT at an address
            </h1>
            <p className={`mt-4 font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}>
              To Tether, issuer of USDT · {chain.asset}
            </p>
          </div>
          <div className={`mt-10 border-l-2 pl-6 ${SHEET.rule}`}>
            <p className={`text-sm leading-7 ${SHEET.body}`}>
              <strong className={SHEET.ink}>This is a draft prepared from an automated investigative lead.</strong>{" "}
              The address below is not attributed to anyone: the finding is that USDT traced from a reported fraud
              reached it, and no outgoing transfer from it was observed when the chain was read. It requires
              completion and signature by an authorised officer before issue.
            </p>
          </div>
        </header>

        <Section n="01" title="Address holding the funds">
          <p className="font-mono text-lg break-all">{resting.address}</p>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field label="USDT traced to it">
              <span className="font-mono tabular-nums">{formatUsdt(resting.heldUsdt)}</span>
              {node ? <span className={SHEET.faint}> · {formatPercent(node.taintFraction)} of the amount traced</span> : null}
            </Field>
            <Field label="Chain and token">{chain.name} · {chain.asset}</Field>
            <Field label="State when read">No outgoing transfer observed since the money arrived</Field>
            <Field label="Chain read">{formatDateTime(trace.provenance.generatedAt)}</Field>
          </dl>
        </Section>

        <Section n="02" title="The reported fraud">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Field label="Case reference">{trace.caseId}</Field>
            <Field label={given.since ? "Date of fraud" : "Window opened (no date reported)"}>
              {formatDateTime(trace.fraudDate)}
            </Field>
            <Field label="Victim-reported address">
              <span className="font-mono text-xs break-all">{trace.inputAddress}</span>
            </Field>
            <Field label={given.amount ? "Amount reported" : "Amount traced (none reported)"}>
              <span className="font-mono tabular-nums">{formatUsdt(trace.reportedAmountUsdt)}</span>
            </Field>
          </dl>
          <p className={`mt-6 text-sm leading-7 ${SHEET.body}`}>{trace.triageReason}</p>
        </Section>

        <Section n="03" title="What is requested">
          <ol className={`space-y-4 text-sm leading-7 ${SHEET.body}`}>
            {[
              "Freeze the USDT held at the address in section 01, pending legal process.",
              "Say whether the address was already frozen, and from when.",
              "Preserve any records Tether holds relating to the address.",
              "Confirm receipt of this request and the action taken, to the contact given in section 05.",
            ].map((line, i) => (
              <li key={line} className="flex gap-4">
                <span className={`font-mono text-xs ${SHEET.faint}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section n="04" title="Verification">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            The trace behind this request rests on {trace.provenance.responseHashes.length} public blockchain{" "}
            {trace.provenance.responseHashes.length === 1 ? "response" : "responses"}, each listed by its SHA-256
            digest in the case&rsquo;s evidence packet. The findings fingerprint below re-derives from the chain as it
            stood at that moment.
          </p>
          <div className={`mt-6 border-t pt-6 ${SHEET.ruleSoft}`}>
            <FingerprintBlock
              fingerprint={fingerprint}
              href={checkHref(trace, source, { ...given, ack }, fingerprint)}
              readAt={trace.provenance.generatedAt}
            />
          </div>
        </Section>

        <Section n="05" title="Issued by">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            To be completed by the authorised officer. This tool does not assert a legal basis; the provision under
            which the request is issued is a matter for the issuing authority, who may choose one below or write it in.
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <Blank label="FIR number" />
            <Blank label="NCRP acknowledgement number" value={ack} />
            <Blank label="Scam typology (as reported)" value={typology ? typologyLabel(typology) : undefined} />
            <Blank label="Name of officer" />
            <Blank label="Designation" />
            <Blank label="Unit / police station" />
            <Blank label="Contact for response" />
            <LegalBasisPicker fraudDate={trace.fraudDate} />
            <Blank label="Date" />
            <Blank label="Duration of the restriction" />
          </div>
          <div className="mt-10 sm:w-1/2">
            <Blank label="Signature and seal" />
          </div>
        </Section>

        <footer className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
          <p className={`font-mono text-[10px] leading-6 uppercase tracking-[0.14em] ${SHEET.faint}`}>
            FineX · {trace.caseId} · generated {generated} · draft for issue by an authorised officer
          </p>
        </footer>
      </article>
    </div>
  );
}
