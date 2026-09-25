"use client";

/**
 * One request to one exchange, for every complaint that ended there.
 *
 * Built from the same pinned runs as each complaint's own request (see
 * lib/combined.ts), and with the same two rules as that request: it is a draft
 * an authorised officer completes and signs, and it asserts no legal basis.
 * Every account is listed with the complaints that reached it, every complaint
 * with its acknowledgement number, every incoming transfer with its hash — so
 * the exchange can act on one document instead of reconciling many.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTrace, traceHref, type DataSource } from "@/lib/api";
import { chainMeta } from "@/lib/chain-meta";
import type { CombinedCase } from "@/lib/combined";
import { fiuListing, fiuSentence } from "@/lib/fiu";
import { formatDateTime, formatPercent, formatUsdt, shortAddress } from "@/lib/format";
import type { Label, TraceResult } from "@/lib/types";
import { Blank, Field, SHEET, Section } from "./FreezeRequest";
import { checkHref, findingsFingerprint } from "@/lib/fingerprint";
import { FingerprintLine } from "./PacketFingerprint";
import SendingGuide from "./SendingGuide";
import OutcomeRecorder from "./OutcomeRecorder";
import { Designation, Spinner, buttonStyles, entityPhrase } from "./ui";

type Loaded = { c: CombinedCase; trace: TraceResult; source: DataSource };
type Excluded = { c: CombinedCase; reason: string };

interface Account {
  address: string;
  label: Label;
  isDeposit: boolean;
  chain: TraceResult["chain"];
  complaints: Loaded[];
  usdt: number;
}

export default function CombinedFreezeRequest({
  entity,
  cases,
}: {
  entity: string | null;
  cases: CombinedCase[];
}) {
  // Results are tagged with the case list they answer for, so "loading" is
  // derived rather than set synchronously in the effect.
  const key = JSON.stringify(cases);
  const [state, setState] = useState<{
    key: string;
    loaded: Loaded[];
    excluded: Excluded[];
    done: boolean;
  } | null>(null);

  useEffect(() => {
    if (!entity) return;
    let live = true;
    const list = JSON.parse(key) as CombinedCase[];
    (async () => {
      const loaded: Loaded[] = [];
      const excluded: Excluded[] = [];
      // One at a time: the chain clients pace themselves, and a throttled read
      // is not an empty one.
      for (const c of list) {
        const lookup = await getTrace(c.address, undefined, {
          amount: c.amount,
          since: c.since,
          asOf: c.asOf,
        });
        if (!live) return;
        if (lookup.status !== "resolved") {
          excluded.push({ c, reason: lookup.status === "invalid" ? lookup.reason : lookup.detail });
        } else {
          const exit = lookup.data.terminal;
          const exchangeExit =
            exit && (exit.label.kind === "exchange_deposit" || exit.label.kind === "exchange_hot");
          if (!exit || !exchangeExit || exit.label.entity !== entity) {
            excluded.push({ c, reason: `This run does not end at ${entity}, so it is not listed.` });
          } else {
            loaded.push({ c, trace: lookup.data, source: lookup.source });
          }
        }
        setState({ key, loaded: [...loaded], excluded: [...excluded], done: false });
      }
      if (live) setState({ key, loaded, excluded, done: true });
    })();
    return () => {
      live = false;
    };
  }, [key, entity]);

  if (!entity || cases.length === 0) {
    return (
      <Nothing
        title="Nothing to combine"
        body="A combined request is opened from Batch triage, where two or more complaints end at the same exchange. This link carries no complaints."
      />
    );
  }

  const current = state?.key === key ? state : null;
  if (!current || !current.done) {
    const n = current ? current.loaded.length + current.excluded.length : 0;
    return (
      <div className="flex items-center gap-4 border-l-2 border-brass-dim py-6 pl-6">
        <Spinner className="text-brass" />
        <span className="text-sm text-faint">
          Opening complaint {Math.min(n + 1, cases.length)} of {cases.length} for {entity}…
        </span>
      </div>
    );
  }

  const { loaded, excluded } = current;
  if (loaded.length === 0) {
    return (
      <Nothing
        title={`No complaint in this link ends at ${entity}`}
        body={excluded.map((e) => `${shortAddress(e.c.address)}: ${e.reason}`).join(" ")}
      />
    );
  }

  // The accounts to restrict, each with the complaints that reached it.
  const byAccount = new Map<string, Account>();
  for (const l of loaded) {
    const exit = l.trace.terminal!;
    const node = l.trace.nodes.find((n) => n.address === exit.address);
    const account = byAccount.get(exit.address) ?? {
      address: exit.address,
      label: exit.label,
      isDeposit: exit.label.kind === "exchange_deposit" && Boolean(exit.depositAddress),
      chain: l.trace.chain,
      complaints: [],
      usdt: 0,
    };
    account.complaints.push(l);
    account.usdt += node?.taintedValueUsdt ?? 0;
    byAccount.set(exit.address, account);
  }
  const accounts = [...byAccount.values()].sort((a, b) => b.usdt - a.usdt);
  const arrivals = loaded
    .flatMap((l) =>
      l.trace.edges
        .filter((e) => e.to === l.trace.terminal!.address)
        .map((e) => ({ ...e, account: l.trace.terminal!.address })),
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const total = accounts.reduce((sum, a) => sum + a.usdt, 0);
  const hashes = loaded.reduce((sum, l) => sum + l.trace.provenance.responseHashes.length, 0);
  // Deterministic: the latest moment any listed run was read, not the render time.
  const generated = loaded
    .map((l) => l.trace.provenance.generatedAt)
    .sort()
    .at(-1)!
    .replace(/\.\d+Z$/, "Z");
  const fiu = fiuListing(entity);
  const recorded = loaded.filter((l) => l.source === "demo").length;
  const plural = accounts.length === 1 ? "account" : "accounts";

  return (
    <div className="space-y-6">
      {/* Console chrome — stays dark, never prints. */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-faint">
          {loaded.length} complaints · {accounts.length} {plural} ·{" "}
          {recorded ? `${recorded} from recorded cases` : "read from the chain"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/queue" className={buttonStyles.secondary}>
            Back to batch triage
          </Link>
          <button type="button" onClick={() => window.print()} className={buttonStyles.primary}>
            Print / save as PDF
          </button>
        </div>
      </div>
      {excluded.length ? (
        <div className="border-l-2 border-line py-2 pl-4 print:hidden">
          <Designation>Not listed</Designation>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-faint">
            {excluded.map((e) => (
              <li key={`${e.c.address}${e.c.ack ?? ""}`}>
                <span className="font-mono">{e.c.ack ? `${e.c.ack} · ` : ""}{shortAddress(e.c.address)}</span> — {e.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Where this exchange takes requests, and what it needs first. */}
      <SendingGuide exchange={entity} />

      <article className={`fx-print-sheet mx-auto max-w-4xl bg-[#fafaf8] p-6 md:p-10 ${SHEET.ink}`}>
        <header className="fx-print-block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="font-document text-xl uppercase tracking-[0.32em]">FineX</p>
            <p className={`font-mono text-xs tracking-[0.14em] ${SHEET.faint}`}>
              COMBINED · {loaded.length} COMPLAINTS · GENERATED {generated}
            </p>
          </div>
          <div className={`mt-6 border-t-2 pt-6 ${SHEET.rule}`}>
            <h1 className="font-document text-4xl leading-[1.1] tracking-tight md:text-5xl">
              Request to restrict
              <br />
              and preserve
            </h1>
            <p className={`mt-4 font-mono text-xs uppercase tracking-[0.18em] ${SHEET.faint}`}>
              To the law-enforcement desk · {entity}
            </p>
            {fiu ? (
              <p className={`mt-2 text-sm leading-6 ${SHEET.body}`}>{fiuSentence(entity, fiu)}</p>
            ) : null}
          </div>
          <div className={`mt-10 border-l-2 pl-6 ${SHEET.rule}`}>
            <p className={`text-sm leading-7 ${SHEET.body}`}>
              <strong className={SHEET.ink}>
                This is a draft prepared from automated investigative leads.
              </strong>{" "}
              It brings together {loaded.length} complaints whose traced funds reached{" "}
              {entity}, so that one request covers them. Each attribution below is produced
              by transaction-pattern analysis of public blockchain data and carries the
              confidence and source tier stated in section 02. It is a lead for an
              investigator to act on — not, on its own, grounds to restrict an account. It
              requires completion and signature by an authorised officer before issue.
            </p>
          </div>
        </header>

        <Section n="01" title={`${accounts.length === 1 ? "Account" : "Accounts"} to be restricted`}>
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            {formatUsdt(total)} traced from {loaded.length} complaints reached the{" "}
            {plural} below. We request that {entity} identify the account holder behind each
            and restrict {accounts.length === 1 ? "it" : "them"} pending legal process.
          </p>
          <ul className="mt-6 space-y-6">
            {accounts.map((a) => (
              <li key={a.address} className={`border-t pt-4 ${SHEET.ruleSoft}`}>
                <p className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
                  {a.isDeposit ? `Customer deposit address at ${entity}` : `${entity}-controlled wallet`} ·{" "}
                  {chainMeta(a.chain).scope}
                </p>
                <code className="mt-2 block break-all font-mono text-lg leading-tight md:text-xl">
                  {a.address}
                </code>
                <p className={`mt-2 text-sm ${SHEET.body}`}>
                  {formatUsdt(a.usdt)} from {a.complaints.length}{" "}
                  {a.complaints.length === 1 ? "complaint" : "complaints"}
                  {a.complaints.some((l) => l.c.ack)
                    ? ` (NCRP ${a.complaints.map((l) => l.c.ack ?? l.trace.caseId).join(", ")})`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section n="02" title="Basis for the identification">
          <ul className="space-y-6">
            {accounts.map((a) => (
              <li key={a.address}>
                <dl className="grid gap-6 sm:grid-cols-3">
                  <Field label="Account">
                    <span className="font-mono text-xs">{shortAddress(a.address, 10, 8)}</span>
                  </Field>
                  <Field label="Attribution">{entityPhrase(a.label)}</Field>
                  <Field label="Confidence · source">
                    <span className="font-mono tabular-nums">
                      {formatPercent(a.label.confidence)} · {a.label.source.replace(/_/g, " ")}
                    </span>
                  </Field>
                </dl>
                {a.label.evidence ? (
                  <p className={`mt-2 font-mono text-xs leading-6 wrap-anywhere ${SHEET.body}`}>
                    {a.label.evidence}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {accounts.some((a) => a.label.source === "heuristic") ? (
            <p className={`mt-6 text-xs leading-6 ${SHEET.faint}`}>
              A heuristic attribution is derived from observed transaction behaviour, not from a
              disclosure by {entity}. Confirmation rests with the exchange.
            </p>
          ) : null}
        </Section>

        <Section n="03" title="The reported frauds">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className={`border-b ${SHEET.rule}`}>
                  {["NCRP acknowledgement", "Case", "Reported wallet", "Reported", "Date of fraud", "Reached"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.16em] ${SHEET.faint}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loaded.map((l) => {
                  const node = l.trace.nodes.find((n) => n.address === l.trace.terminal!.address);
                  return (
                    <tr key={`${l.c.address}${l.c.ack ?? ""}`} className={`border-b ${SHEET.ruleSoft}`}>
                      <td className="py-2 pr-4 font-mono text-xs">{l.c.ack ?? "—"}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{l.trace.caseId}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{shortAddress(l.trace.inputAddress, 8, 6)}</td>
                      <td className="py-2 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatUsdt(l.trace.reportedAmountUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(l.trace.fraudDate)}
                      </td>
                      <td className="py-2 font-mono text-xs tabular-nums whitespace-nowrap">
                        {node ? formatUsdt(node.taintedValueUsdt, { symbol: false }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section n="04" title="Transfers into the named accounts">
          {arrivals.length === 0 ? (
            <p className={`text-sm leading-7 ${SHEET.body}`}>
              No transfer into these accounts fell inside the traced windows.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <thead>
                  <tr className={`border-b ${SHEET.rule}`}>
                    {["Account", "Date (UTC)", "Amount (USDT)", "From", "Transaction"].map((h) => (
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
                    <tr key={`${e.txHash}${e.from}`} className={`border-b ${SHEET.ruleSoft}`}>
                      <td className="py-2 pr-4 font-mono text-xs">{shortAddress(e.account, 6, 4)}</td>
                      <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{formatDateTime(e.timestamp)}</td>
                      <td className="py-2 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatUsdt(e.valueUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{shortAddress(e.from, 8, 6)}</td>
                      <td className="py-2 font-mono text-[10px] break-all">{e.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section n="05" title="What is requested">
          <ol className={`space-y-4 text-sm leading-7 ${SHEET.body}`}>
            {[
              `Identify the account holder behind each ${accounts.some((a) => a.isDeposit) ? "deposit address" : "credited account"} in section 01.`,
              `Restrict withdrawals and transfers from ${accounts.length === 1 ? "that account" : "those accounts"} pending legal process.`,
              `Preserve all account records, KYC documentation, login and device metadata, and transaction history relating to ${accounts.length === 1 ? "it" : "them"}.`,
              `Confirm receipt of this request and the action taken on each account, to the contact given in section 07.`,
            ].map((line, i) => (
              <li key={i} className="flex gap-4">
                <span className={`font-mono text-xs ${SHEET.faint}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section n="06" title="Verification">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            Each complaint listed was traced from public blockchain data, and its own evidence
            packet lists the SHA-256 of every chain response it rests on — {hashes} responses in
            all. Each case can be re-derived from the chain as of the moment it was read and will
            show the figures above. Each complaint&rsquo;s findings fingerprint is listed with the
            link that checks it: the link re-derives that complaint and states whether its
            findings still produce the fingerprint.
          </p>
          <ul className="mt-6 space-y-4">
            {loaded.map((l) => {
              const fp = findingsFingerprint(l.trace);
              return (
                <FingerprintLine
                  key={l.c.address}
                  label={`${l.trace.caseId}${l.c.ack ? ` · NCRP ${l.c.ack}` : ""}`}
                  fingerprint={fp}
                  href={checkHref(l.trace, l.source, l.c, fp)}
                />
              );
            })}
          </ul>
        </Section>

        <Section n="07" title="Issued by">
          <p className={`text-sm leading-7 ${SHEET.body}`}>
            To be completed by the authorised officer. This tool does not assert a legal basis;
            the provision under which the request is issued is a matter for the issuing authority.
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <Blank label="FIR number(s)" />
            <Blank
              label="NCRP acknowledgement numbers"
              value={loaded.some((l) => l.c.ack) ? "Listed in section 03" : undefined}
            />
            <Blank label="Name of officer" />
            <Blank label="Designation" />
            <Blank label="Unit / police station" />
            <Blank label="Contact for response" />
            <Blank label="Issued under" />
            <Blank label="Date" />
            <Blank label="Duration of the restriction" />
          </div>
          <div className="mt-10 sm:w-1/2">
            <Blank label="Signature and seal" />
          </div>
        </Section>

        <footer className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
          <p className={`font-mono text-[10px] leading-6 uppercase tracking-[0.14em] ${SHEET.faint}`}>
            FineX · combined request to {entity} · generated {generated} · draft for issue by an
            authorised officer
          </p>
        </footer>
      </article>

      {/* After it is sent: one record per complaint in the letter. Never printed. */}
      <OutcomeRecorder
        targets={loaded.flatMap((l) => {
          const t = l.trace.terminal;
          if (!t) return [];
          return [
            {
              chain: l.trace.chain,
              caseId: l.trace.caseId,
              address: l.trace.inputAddress,
              exchange: entity,
              account: t.depositAddress ?? t.address,
              tracedUsdt: l.trace.nodes.find((n) => n.address === t.address)?.taintedValueUsdt ?? 0,
              ...(l.c.ack ? { ack: l.c.ack } : {}),
              href: traceHref("freeze", l.trace, l.c.ack),
            },
          ];
        })}
      />
    </div>
  );
}

function Nothing({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-line bg-surface p-6">
      <Designation>[ nothing to request ]</Designation>
      <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.08em] text-ink">{title}</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{body}</p>
      <Link href="/queue" className={`${buttonStyles.secondary} mt-6`}>
        Batch triage
      </Link>
    </div>
  );
}
