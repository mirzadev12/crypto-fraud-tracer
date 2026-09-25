"use client";

import Link from "next/link";
import {
  formatDateTime,
  formatPercent,
  formatUsdt,
  shortAddress,
} from "@/lib/format";
import { traceHref } from "@/lib/api";
import {
  InvalidAddressState,
  NoTraceState,
  TraceSkeleton,
  useTrace,
} from "./TraceLoader";
import {
  DataSourceBadge,
  Designation,
  SourceChip,
  TriageBadge,
  buttonStyles,
  entityPhrase,
} from "./ui";
import { chainMeta } from "@/lib/chain-meta";
import { fiuListing, fiuSentence } from "@/lib/fiu";
import { checkHref, findingsFingerprint } from "@/lib/fingerprint";
import { FingerprintBlock } from "./PacketFingerprint";

/**
 * The last mile of the product.
 *
 * Every other screen tells an investigator what happened. This one produces the
 * thing they actually send: a request to the exchange naming the account that
 * can be restricted. The whole thesis of the tool — that naming the *deposit
 * address* is what makes a trace actionable — is worth nothing until it leaves
 * the screen in a form somebody can file.
 *
 * Two rules govern it, and both are about not overstating what we hold.
 *
 * 1. **It is a draft, not an instrument.** It says so in its own body. A
 *    clustering heuristic is an investigative lead; it is not grounds to freeze
 *    anything, and the document must never read as though a student could issue
 *    it. The signature block is deliberately empty.
 * 2. **It does not invent a legal basis.** "Issued under" is a blank an
 *    authorised officer fills. Hard-coding a section of the CrPC or the BNSS
 *    would put a citation we cannot verify into a document addressed to a
 *    foreign exchange — a worse failure than leaving the line open.
 *
 * Styled as the evidence packet is: a light sheet inside the dark console,
 * because what matters is what comes out of the printer. Palette values are
 * literal for the same reason the packet's are — the app tokens are dark.
 */

/** Shared with the combined request (CombinedFreezeRequest), so the two documents cannot drift apart. */
export const SHEET = {
  ink: "text-[#141412]",
  body: "text-[#4a4741]",
  faint: "text-[#75726a]",
  rule: "border-[#d9d5cb]",
  ruleSoft: "border-[#e6e2d8]",
};

export function Section({
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${SHEET.ink}`}>{children}</dd>
    </div>
  );
}

/** A line the issuing officer completes by hand or in the PDF. */
export function Blank({
  label,
  width = "w-full",
  value,
}: {
  label: string;
  width?: string;
  /** Filled in when the tool genuinely knows it, e.g. from a complaint sheet. */
  value?: string;
}) {
  return (
    <div className={width}>
      <div className={`flex h-8 items-end border-b pb-1 font-mono text-sm ${SHEET.rule} ${SHEET.ink}`}>
        {value ?? ""}
      </div>
      <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${SHEET.faint}`}>
        {label}
      </p>
    </div>
  );
}

export default function FreezeRequest({
  address,
  amount,
  since,
  asOf,
  ack,
}: {
  address: string;
  amount?: number;
  since?: string;
  asOf?: string;
  /** The complaint's acknowledgement number, from a complaint sheet. */
  ack?: string;
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

  // No exchange endpoint means there is no one to write to. Saying that plainly
  // is better than printing a request with an empty addressee.
  if (!trace.terminal) {
    return (
      <div className="space-y-6">
        <div className="border border-line bg-surface p-6">
          <Designation>[ nothing to request ]</Designation>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.08em] text-ink">
            No exchange endpoint was identified
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            {trace.triageReason}
          </p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-faint">
            A restraint request names an account at a service that can act on it.
            This trail has not reached one, so there is nothing to ask for yet.
          </p>
          <Link
            href={traceHref("trace", trace, ack)}
            className={`${buttonStyles.secondary} mt-6`}
          >
            Back to trace
          </Link>
        </div>
      </div>
    );
  }

  const { label, depositAddress } = trace.terminal;
  const terminalAddress = trace.terminal.address;
  const named = depositAddress ?? terminalAddress;
  const isDeposit = label.kind === "exchange_deposit" && Boolean(depositAddress);
  const terminalNode = trace.nodes.find((n) => n.address === terminalAddress);

  // The transfers the exchange has to look up: everything that landed on the
  // named account inside the traced window.
  const arrivals = trace.edges
    .filter((e) => e.to === terminalAddress)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const generated = trace.provenance.generatedAt.replace(/\.\d+Z$/, "Z");
  const chain = chainMeta(trace.chain);
  // The legal entity the request is addressed to, where the one government
  // document that names FIU-IND registrants lists it. See lib/fiu.ts.
  const fiu = fiuListing(label.entity);
  const caseRef = `${trace.caseId} · ${chain.scope} · GENERATED ${generated}`;

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
        <div className="flex flex-wrap gap-2">
          <Link href={traceHref("trace", trace, ack)} className={buttonStyles.secondary}>
            Back to trace
          </Link>
          <Link href={traceHref("report", trace, ack)} className={buttonStyles.secondary}>
            Evidence packet
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

      {/* -------------------------------------------------------------- sheet */}
      <article
        className={`fx-print-sheet mx-auto max-w-4xl bg-[#fafaf8] p-6 md:p-10 ${SHEET.ink}`}
      >
        <header className="fx-print-block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="font-document text-xl uppercase tracking-[0.32em]">FineX</p>
            <p className={`font-mono text-xs tracking-[0.14em] ${SHEET.faint}`}>{caseRef}</p>
          </div>

          <div className={`mt-6 border-t-2 pt-6 ${SHEET.rule}`}>
            <h1 className="font-document text-4xl leading-[1.1] tracking-tight md:text-5xl">
              Request to restrict
              <br />
              and preserve
            </h1>
            <p
              className={`mt-4 font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}
            >
              To the law-enforcement desk · {label.entity}
            </p>
            {fiu ? (
              <p className={`mt-2 text-sm leading-6 ${SHEET.body}`}>
                {fiuSentence(label.entity, fiu)}
              </p>
            ) : null}
          </div>

          {/* The guard. It sits above the request, not in a footnote, because a
              reader who stops after the first page must still have seen it. */}
          <div className={`mt-10 border-l-2 pl-6 ${SHEET.rule}`}>
            <p className={`text-sm leading-7 ${SHEET.body}`}>
              <strong className={SHEET.ink}>This is a draft prepared from an
              automated investigative lead.</strong>{" "}
              The attribution below is produced by transaction-pattern analysis of
              public blockchain data and carries the confidence and source tier
              stated in section 02. It is a lead for an investigator to act on —
              not, on its own, grounds to restrict an account. It requires
              completion and signature by an authorised officer before issue.
            </p>
          </div>
        </header>

        {/* ------------------------------------------------------------- 01 */}
        <Section n="01" title={isDeposit ? "Account to be restricted" : "Receiving wallet"}>
          <p className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
            {isDeposit
              ? "Customer deposit address at " + label.entity
              : "Exchange-controlled wallet"}
          </p>
          {/* Set larger than any heading on the sheet. It is the request. */}
          <code className="mt-4 block break-all font-mono text-2xl leading-tight tracking-tight md:text-3xl">
            {named}
          </code>

          <p className={`mt-4 text-sm leading-7 ${SHEET.body}`}>
            {isDeposit ? (
              <>
                Transaction-pattern analysis indicates this address is a customer
                deposit address controlled by {label.entity} on behalf of an
                account holder. We request that {label.entity} identify the
                account it belongs to and restrict it pending legal process.
              </>
            ) : (
              <>
                Funds traced from the reported address arrived at this{" "}
                {label.entity}-controlled wallet. We request that {label.entity}{" "}
                identify the customer account credited by the transfers listed in
                section 04 and restrict it pending legal process.
              </>
            )}
          </p>
        </Section>

        {/* ------------------------------------------------------------- 02 */}
        <Section n="02" title="Basis for the identification">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Field label="Attribution">{entityPhrase(label)}</Field>
            <Field label="Confidence">
              <span className="font-mono tabular-nums">
                {formatPercent(label.confidence)}
              </span>
            </Field>
            <Field label="Source tier">
              <span className="print:hidden">
                <SourceChip source={label.source} />
              </span>
              <span className="hidden font-mono uppercase tracking-[0.14em] print:inline">
                {label.source.replace(/_/g, " ")}
              </span>
            </Field>
            <Field label="Value traced to this account">
              <span className="font-mono tabular-nums">
                {terminalNode ? formatUsdt(terminalNode.taintedValueUsdt) : "—"}
                {terminalNode ? (
                  <span className={SHEET.faint}>
                    {" "}
                    · {formatPercent(terminalNode.taintFraction)} of the reported
                    amount
                  </span>
                ) : null}
              </span>
            </Field>
          </dl>

          {label.evidence ? (
            <p
              className={`mt-6 border-t pt-4 font-mono text-xs leading-6 ${SHEET.rule} ${SHEET.body}`}
            >
              {label.evidence}
            </p>
          ) : null}

          {label.source === "heuristic" ? (
            <p className={`mt-4 text-xs leading-6 ${SHEET.faint}`}>
              A heuristic attribution is derived from observed transaction
              behaviour, not from a disclosure by {label.entity}. Confirmation
              rests with the exchange.
            </p>
          ) : null}
        </Section>

        {/* ------------------------------------------------------------- 03 */}
        <Section n="03" title="The reported fraud">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Field label="Case reference">
              <span className="font-mono">{trace.caseId}</span>
            </Field>
            <Field label="Date of fraud">{formatDateTime(trace.fraudDate)}</Field>
            <Field label="Victim-reported address">
              <code className="break-all font-mono text-xs">{trace.inputAddress}</code>
            </Field>
            <Field label="Amount reported">
              <span className="font-mono tabular-nums">
                {formatUsdt(trace.reportedAmountUsdt)}
              </span>
            </Field>
          </dl>
          <p className={`mt-6 text-sm leading-7 ${SHEET.body}`}>
            The funds were followed across {trace.nodes.length}{" "}
            {trace.nodes.length === 1 ? "wallet" : "wallets"} and {trace.edges.length}{" "}
            {trace.edges.length === 1 ? "transfer" : "transfers"} on the {chain.name} network, in {chain.asset},
            from the reported address to the account named in section 01.
          </p>
        </Section>

        {/* ------------------------------------------------------------- 04 */}
        <Section n="04" title="Transfers into the named account">
          {arrivals.length === 0 ? (
            <p className={`text-sm leading-7 ${SHEET.body}`}>
              No transfer into this account fell inside the traced window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className={`border-b ${SHEET.rule}`}>
                    {["Date (UTC)", "Amount (USDT)", "From", "Transaction"].map((h) => (
                      <th
                        key={h}
                        className={`pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.16em] ${SHEET.faint}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {arrivals.map((e) => (
                    <tr key={e.txHash} className={`border-b ${SHEET.ruleSoft}`}>
                      <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(e.timestamp)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatUsdt(e.valueUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {shortAddress(e.from, 8, 6)}
                      </td>
                      <td className="py-2 font-mono text-[10px] break-all">{e.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ------------------------------------------------------------- 05 */}
        <Section n="05" title="What is requested">
          <ol className={`space-y-4 text-sm leading-7 ${SHEET.body}`}>
            {[
              isDeposit
                ? `Identify the account holder to whom the deposit address in section 01 belongs.`
                : `Identify the customer account credited by the transfers in section 04.`,
              `Restrict withdrawals and transfers from that account pending legal process.`,
              `Preserve all account records, KYC documentation, login and device metadata, and transaction history relating to it.`,
              `Confirm receipt of this request and the action taken, to the contact given in section 07.`,
            ].map((line, i) => (
              <li key={i} className="flex gap-4">
                <span className={`font-mono text-xs ${SHEET.faint}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* ------------------------------------------------------------- 06 */}
        <Section n="06" title="Verification">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            This request was generated from{" "}
            {trace.provenance.responseHashes.length} public blockchain API{" "}
            {trace.provenance.responseHashes.length === 1 ? "response" : "responses"}.
            The SHA-256 digest of each is listed below, so every figure above can
            be re-derived from the same source data.
            {trace.provenance.apiCalls > trace.provenance.responseHashes.length
              ? ` ${trace.provenance.apiCalls - trace.provenance.responseHashes.length} further requests were refused or timed out and contributed nothing.`
              : ""}
          </p>
          {trace.provenance.responseHashes.length > 0 ? (
            <ul className={`mt-4 space-y-1 font-mono text-[10px] break-all ${SHEET.faint}`}>
              {trace.provenance.responseHashes.map((h, i) => (
                <li key={`${i}-${h}`}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className={`mt-4 text-xs ${SHEET.faint}`}>No response hashes recorded.</p>
          )}
          {/* The evidence packet for this case prints the same fingerprint. */}
          <div className={`mt-6 border-t pt-6 ${SHEET.ruleSoft}`}>
            <FingerprintBlock
              fingerprint={findingsFingerprint(trace)}
              href={checkHref(trace, current.lookup.source, { amount, since, asOf, ack })}
              readAt={trace.provenance.generatedAt}
            />
          </div>
        </Section>

        {/* ------------------------------------------------------------- 07 */}
        <Section n="07" title="Issued by">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            To be completed by the authorised officer. This tool does not assert a
            legal basis; the provision under which the request is issued is a
            matter for the issuing authority.
          </p>
          {/* The case references an Indian officer files against. Without them
              this reads as a template rather than a document belonging to a
              case; with them the exchange can tie the request to a complaint
              on record. They are blanks, not claims — the tool has no way to
              know either number, and still asserts no statute. */}
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <Blank label="FIR number" />
            <Blank label="NCRP acknowledgement number" value={ack} />
            <Blank label="Name of officer" />
            <Blank label="Designation" />
            <Blank label="Unit / police station" />
            <Blank label="Contact for response" />
            <Blank label="Issued under" />
            <Blank label="Date" />
          </div>
          <div className="mt-10 sm:w-1/2">
            <Blank label="Signature and seal" />
          </div>
        </Section>

        <footer className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
          <p className={`font-mono text-[10px] leading-6 uppercase tracking-[0.14em] ${SHEET.faint}`}>
            FineX · {trace.caseId} · generated {generated} · draft for issue by an
            authorised officer
          </p>
        </footer>
      </article>
    </div>
  );
}
