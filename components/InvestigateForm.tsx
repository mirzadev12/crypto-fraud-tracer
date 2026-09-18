"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_SAMPLES, runTrace, sampleHref, traceHref, type TraceLookup } from "@/lib/api";
import { checkTronAddress, isTxHash } from "@/lib/tron";
import type { ResolvedTransfer, TxLookup } from "@/lib/txlookup";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import TraceView from "./TraceView";
import {
  InvalidAddressState,
  NoTraceState,
  TraceSkeleton,
  type TimedEvent,
} from "./TraceLoader";
import {
  CASE_PROOF,
  Designation,
  Diamond,
  ErrorState,
  SectionHeader,
  Spinner,
  TriageBadge,
  buttonStyles,
} from "./ui";

type Status =
  | { kind: "idle" }
  | { kind: "running"; events: TimedEvent[] }
  | { kind: "done"; lookup: TraceLookup }
  | { kind: "failed"; message: string };

/**
 * An intake docket, not a sign-up form. Fields are ruled lines rather than
 * boxes: the value an officer types is the only filled thing on the page, and
 * the standing limits of the trace are stated beside it instead of buried in
 * helper text under the button.
 */
const FIELD =
  "w-full min-w-0 border-0 border-b bg-transparent px-0 py-4 font-mono text-ink placeholder:text-dim";

/** The limits are fixed by the pipeline, so the docket states them as facts. */
const PARAMETERS: Array<[string, string]> = [
  ["Chain", "TRON · USDT (TRC-20)"],
  ["Depth", "3 hops"],
  ["Outflows", "Top 5 per wallet, by value"],
  ["Dust", "Under 1% of amount traced, dropped"],
  ["Window", "After the fraud date, or full history"],
  ["Stop", "First attributable address"],
];

export default function InvestigateForm() {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  // Blank means "auto": the trace opens at the wallet's own first transfer. It
  // used to default to today, and nothing before the fraud date is followed,
  // so most wallets came back with no data at all.
  const [fraudDate, setFraudDate] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  /*
   * What an officer actually holds.
   *
   * A complainant reports a phone number or a UPI ID, never a wallet. The
   * address realistically comes from the victim's own exchange withdrawal —
   * that is, from a transaction. So this field takes either, and a hash is
   * resolved to the wallet the money went to before anything is traced.
   */
  const [resolved, setResolved] = useState<ResolvedTransfer | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);

  const addressCheck = useMemo(() => checkTronAddress(address), [address]);
  const looksLikeTx = useMemo(() => isTxHash(address), [address]);
  /** The wallet the trace will actually run against. */
  const subject = resolved ? resolved.to : address.trim();
  const amountValue = Number(amount);
  // Amount and date are both optional; only a malformed amount blocks a run.
  const amountValid =
    amount.trim() === "" || (Number.isFinite(amountValue) && amountValue > 0);
  const canSubmit = (addressCheck.valid || Boolean(resolved)) && amountValid;

  /* Resolve in an event handler, never an effect — see CONTEXT.md §5. */
  async function resolveHash() {
    const hash = address.trim();
    if (!isTxHash(hash) || resolving) return;
    setResolving(true);
    setResolveNote(null);
    setResolved(null);
    try {
      const res = await fetch(`/api/tx/${encodeURIComponent(hash)}`);
      const lookup = (await res.json()) as TxLookup;
      if (lookup.status === "resolved") setResolved(lookup.transfer);
      else if (lookup.status === "not-a-hash") setResolveNote(lookup.reason);
      else setResolveNote(lookup.reason);
    } catch (err) {
      setResolveNote(
        err instanceof Error
          ? `The transaction could not be read: ${err.message}`
          : "The transaction could not be read.",
      );
    } finally {
      setResolving(false);
    }
  }

  function onAddressChange(next: string) {
    setAddress(next);
    // A new value invalidates whatever the last one resolved to.
    if (resolved || resolveNote) {
      setResolved(null);
      setResolveNote(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setStatus({ kind: "running", events: [] });
    try {
      const result = await runTrace(
        {
          address: subject,
          // Omitted fields are resolved from the chain by the tracer.
          ...(amount.trim() ? { amount: amountValue } : {}),
          ...(fraudDate
            ? { fraudDate: new Date(`${fraudDate}T00:00:00.000Z`).toISOString() }
            : {}),
        },
        (event) =>
          setStatus((s) =>
            s.kind === "running"
              ? { kind: "running", events: [...s.events, { event, at: Date.now() }] }
              : s,
          ),
      );
      setStatus({ kind: "done", lookup: result });
    } catch (err) {
      setStatus({
        kind: "failed",
        message:
          err instanceof Error
            ? err.message
            : "The trace could not be run against this address.",
      });
    }
  }

  // A transaction hash is not a malformed address; it is the other valid input.
  const showAddressError =
    touched && address !== "" && !addressCheck.valid && !looksLikeTx && !resolved;
  const showAmountError = touched && amount !== "" && !amountValid;

  /*
   * Where "View evidence packet" goes, and for which wallet.
   *
   * After a trace, the packet for the case on screen, pinned to that run's
   * amount and window through `traceHref` — the same rule the Permalink follows,
   * so the packet can never show different figures from the page it was opened
   * under. Before a trace, the packet for whatever wallet the form holds, with
   * the amount and date typed so far; the packet page runs that trace itself.
   * Nothing valid entered, nothing to open.
   */
  const evidence = useMemo((): { href: string; address: string } | null => {
    if (status.kind === "done" && status.lookup.status === "resolved") {
      return {
        href: traceHref("report", status.lookup.data),
        address: status.lookup.data.inputAddress,
      };
    }
    if (!addressCheck.valid && !resolved) return null;
    const query = new URLSearchParams();
    if (amount.trim() && amountValid) query.set("amount", String(amountValue));
    if (fraudDate) query.set("since", new Date(`${fraudDate}T00:00:00.000Z`).toISOString());
    const qs = query.toString();
    return {
      href: `/report/${encodeURIComponent(subject)}${qs ? `?${qs}` : ""}`,
      address: subject,
    };
  }, [status, addressCheck.valid, resolved, amount, amountValid, amountValue, fraudDate, subject]);

  return (
    <div className="space-y-24">
      {/* ------------------------------------------------------------ intake */}
      <section>
        <SectionHeader index="01" title="Intake" kicker="From the complaint" />

        <form onSubmit={onSubmit} noValidate>
          <div className="mt-16 grid gap-16 lg:grid-cols-[1.7fr_1fr]">
            <div className="min-w-0">
              <label htmlFor="address">
                <Designation>Wallet address or transaction</Designation>
              </label>
              <input
                id="address"
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                onBlur={() => {
                  setTouched(true);
                  void resolveHash();
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder="T…  or a transaction hash"
                aria-invalid={showAddressError}
                aria-describedby="address-help"
                className={`${FIELD} mt-4 tracking-tight ${
                  address.length > 40 ? "text-xs md:text-sm" : "text-lg md:text-xl"
                } ${
                  showAddressError
                    ? "border-critical"
                    : addressCheck.valid
                      ? "border-confirmed"
                      : "border-line focus:border-brass"
                }`}
              />
              <p
                id="address-help"
                className={`mt-4 text-xs leading-5 ${
                  showAddressError
                    ? "text-critical"
                    : addressCheck.valid
                      ? "text-confirmed"
                      : "text-faint"
                }`}
              >
                {showAddressError
                  ? addressCheck.reason
                  : addressCheck.valid
                    ? "Checksum valid — the address is well formed."
                    : looksLikeTx
                      ? resolving
                        ? "Reading the transaction…"
                        : "That is a transaction hash. We will read it and trace the wallet it paid."
                      : "Paste the wallet address, or the transaction that sent the money. A complainant rarely has an address; their exchange can produce the transaction."}
              </p>

              {/* What the hash turned out to be, stated before anything is
                  traced. An officer has to be able to see that the wallet we
                  are about to follow is the one their transaction paid. */}
              {resolved ? (
                <div className="mt-6 border-l-2 border-confirmed py-4 pl-6">
                  <Designation>Transaction read</Designation>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    This transaction moved{" "}
                    <strong className="font-semibold text-ink">
                      {formatUsdt(resolved.valueUsdt)}
                    </strong>{" "}
                    on {formatDateTime(resolved.timestamp)}.
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-faint">Paid to</p>
                    <p className="break-all font-mono text-sm text-brass">{resolved.to}</p>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-faint">
                    That wallet is the subject of this trace.
                  </p>
                </div>
              ) : null}

              {resolveNote ? (
                <div className="mt-6 border-l-2 border-critical py-4 pl-6">
                  <p className="text-sm leading-6 text-muted">{resolveNote}</p>
                </div>
              ) : null}

              <div className="mt-16 grid gap-16 sm:grid-cols-2">
                <div>
                  <label htmlFor="amount">
                    <Designation>Reported amount · USDT · optional</Designation>
                  </label>
                  <input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => setTouched(true)}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={showAmountError}
                    className={`${FIELD} mt-4 text-lg tabular-nums ${
                      showAmountError ? "border-critical" : "border-line focus:border-brass"
                    }`}
                  />
                  <p className="mt-4 text-xs leading-5 text-faint">
                    Leave blank to trace everything that left the wallet.
                  </p>
                </div>

                <div>
                  <label htmlFor="fraudDate">
                    <Designation>Date of fraud · optional</Designation>
                  </label>
                  <input
                    id="fraudDate"
                    type="date"
                    value={fraudDate}
                    onChange={(e) => setFraudDate(e.target.value)}
                    className={`${FIELD} mt-4 border-line text-lg focus:border-brass`}
                  />
                  <p className="mt-4 text-xs leading-5 text-faint">
                    Leave blank to follow the wallet from its first transfer.
                  </p>
                </div>
              </div>

              <div className="mt-16 flex flex-wrap items-center gap-6 border-t border-line pt-6">
                <button
                  type="submit"
                  disabled={!canSubmit || status.kind === "running"}
                  className={buttonStyles.primary}
                >
                  {status.kind === "running" ? (
                    <>
                      <Spinner /> Tracing
                    </>
                  ) : (
                    "Run trace"
                  )}
                </button>
                {status.kind === "done" && status.lookup.status === "resolved" ? (
                  <Link
                    href={traceHref("trace", status.lookup.data)}
                    className={buttonStyles.secondary}
                  >
                    Permalink
                  </Link>
                ) : null}
              </div>
            </div>

            {/* The standing limits, stated rather than hidden in helper text. */}
            <aside>
              <Designation>Trace parameters</Designation>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {PARAMETERS.map(([term, value]) => (
                  <div key={term} className="flex items-baseline gap-6 py-4">
                    <dt className="w-24 shrink-0 font-label text-xs uppercase tracking-[0.16em] text-faint">
                      {term}
                    </dt>
                    <dd className="text-xs leading-5 text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-xs leading-6 text-faint">
                Fixed by the pipeline, not by the operator. Every trace in the
                register was run under exactly these limits, which is what makes
                two case files comparable.
              </p>
            </aside>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------------- case files */}
      <section>
        <SectionHeader
          index="02"
          title="Recorded traces"
          kicker="Captured from the chain"
        />
        <ul className="mt-16 divide-y divide-line border-y border-line">
          {DEMO_SAMPLES.map((s) => (
            <li key={s.address}>
              <Link
                href={sampleHref(s)}
                className="group flex w-full flex-col gap-4 py-6 text-left transition hover:bg-surface md:flex-row md:items-center md:gap-16"
              >
                <span className="w-40 shrink-0">
                  <TriageBadge level={s.triage} />
                </span>
                <span className="flex-1 text-sm leading-6 text-ink">{CASE_PROOF[s.triage]}</span>
                <span className="font-mono text-xs text-faint">
                  {shortAddress(s.address, 10, 8)}
                </span>
                <span className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition group-hover:text-brass">
                  Open
                  <Diamond className="bg-brass-dim" size={4} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
          Each opens as it was read on 14 September 2026, so it shows the same
          case today. Any other address is read live from the chain. A live
          trace takes roughly half a minute — it is doing the same work as the
          recorded cases above, against whatever the wallet is doing today.
        </p>
      </section>

      {/* ----------------------------------------------------------- results */}
      {status.kind === "running" ? (
        <TraceSkeleton address={address} events={status.events} />
      ) : null}

      {status.kind === "failed" ? (
        <ErrorState
          title="The trace did not run"
          description={`${status.message} With demo mode on, the recorded cases above open from their files without touching the network.`}
        />
      ) : null}

      {status.kind === "done" ? (
        <div className="border-t border-line pt-16">
          {status.lookup.status === "resolved" ? (
            <TraceView
              trace={status.lookup.data}
              source={status.lookup.source}
              note={status.lookup.note}
            />
          ) : status.lookup.status === "invalid" ? (
            <InvalidAddressState
              address={status.lookup.address}
              reason={status.lookup.reason}
            />
          ) : (
            <NoTraceState
              address={status.lookup.address}
              endpoint={status.lookup.endpoint}
              detail={status.lookup.detail}
            />
          )}
        </div>
      ) : null}

      {/* ---------------------------------------------------------- evidence */}
      {/* The last thing on the page, because it is the last step of a case: once
          the trace is read, the packet is what goes on the file. It names the
          wallet it will open, so there is no doubt which case it belongs to. */}
      <section className="border-t border-line pt-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <Designation>Evidence</Designation>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              {evidence ? (
                <>
                  The printable packet for{" "}
                  <span className="font-mono text-ink">{shortAddress(evidence.address)}</span>{" "}
                  — the finding, every transfer, and the fingerprint of each chain
                  response behind it.
                </>
              ) : (
                "Enter a wallet address or a transaction above to open its evidence packet."
              )}
            </p>
          </div>
          {evidence ? (
            <Link href={evidence.href} className={buttonStyles.primary}>
              View evidence packet
            </Link>
          ) : (
            <button type="button" disabled className={buttonStyles.primary}>
              View evidence packet
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
