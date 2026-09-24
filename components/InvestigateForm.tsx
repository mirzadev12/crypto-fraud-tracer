"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_SAMPLES, runTrace, sampleHref, traceHref, type TraceLookup } from "@/lib/api";
import { checkAddress } from "@/lib/address";
import { chainMeta } from "@/lib/chain-meta";
import { isTxHash } from "@/lib/tron";
import { identifyChain } from "@/lib/chains";
import type { Screening } from "@/lib/screen";
import type { ResolvedTransfer, TxLookup } from "@/lib/txlookup";
import { count, formatDate, formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
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
  ["Chains", "TRON · Ethereum mainnet · USDT"],
  ["Other chains", "Screened against OFAC, not traced"],
  ["Depth", "3 hops"],
  ["Outflows", "Top 5 per wallet, by value"],
  ["Dust", "Under 1% of amount traced, dropped"],
  ["Window", "After the fraud date, or full history"],
  ["Stop", "First attributable address"],
];

/** What screening an address on another chain found, in an officer's words. */
function ScreeningResult({
  screened,
}: {
  screened: { for: string; result: Screening | null; error: string | null };
}) {
  const { result, error } = screened;
  if (!result) {
    return (
      <div className="mt-6 border-l-2 border-critical py-4 pl-6">
        <p className="text-sm leading-6 text-muted">
          Not screened: {error ?? "no answer"}. Nothing is concluded about this address.
        </p>
      </div>
    );
  }
  const published = result.list.published ? formatDate(result.list.published) : "its latest publication";
  const scope = `${count(result.list.addresses, "address", "addresses")} across ${count(result.list.assets, "asset")} on the OFAC Specially Designated Nationals list published ${published}`;

  if (result.listing) {
    const l = result.listing;
    return (
      <div className="mt-6 border-l-2 border-critical py-4 pl-6">
        <Designation>OFAC SDN · listed</Designation>
        <p className="mt-4 text-lg leading-7 text-ink">{l.entity}</p>
        <p className="mt-2 font-mono text-xs text-faint">
          {[l.program, `filed under ${l.assets.join(", ")}`].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-4 text-sm leading-6 text-muted">
          This address is on the sanctions list — screened against {scope}. Record it
          on the case file, and confirm against the current list before acting on it.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 border-l-2 border-line py-4 pl-6">
      <Designation>OFAC SDN · not listed</Designation>
      <p className="mt-4 text-sm leading-6 text-muted">
        Screened against {scope}. This address is not on it — which is not a
        clearance: OFAC lists only some of the addresses a designated party controls.
      </p>
      {result.chain?.note ? (
        <p className="mt-4 text-xs leading-5 text-faint">{result.chain.note}</p>
      ) : null}
    </div>
  );
}

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
  /*
   * An address from another chain. FineX traces TRON only, but a complaint does
   * not choose its chain, so such an address is screened against the OFAC list
   * for its chain instead of being refused as "not a TRON address". The result
   * is tagged with the address it answers for, so it can never sit under a
   * different value (the pattern in CONTEXT.md §5).
   */
  const [screening, setScreening] = useState<
    { for: string; result: Screening | null; error: string | null } | null
  >(null);
  const [screeningBusy, setScreeningBusy] = useState(false);

  const addressCheck = useMemo(() => checkAddress(address), [address]);
  const looksLikeTx = useMemo(() => isTxHash(address), [address]);
  /** A recognised address on a chain we screen but do not trace. */
  const otherChain = useMemo(() => {
    const guess = identifyChain(address);
    return guess && !guess.chain.traceable ? guess : null;
  }, [address]);
  /**
   * Addresses the OFAC screen can answer for: every other chain, and Ethereum
   * too — a trace never labels the address it starts from, so screening the
   * reported address itself stays one click away.
   */
  const screenable =
    otherChain ?? (addressCheck.valid && addressCheck.chain === "ethereum" ? identifyChain(address) : null);
  const screened = screening && screening.for === address.trim() ? screening : null;
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

  /* Screen in an event handler, never an effect — see CONTEXT.md §5. */
  async function screenOtherChain() {
    const candidate = address.trim();
    if (!screenable || screeningBusy || screened) return;
    setScreeningBusy(true);
    try {
      const res = await fetch(`/api/screen/${encodeURIComponent(candidate)}`);
      if (!res.ok) throw new Error(`the screening service answered HTTP ${res.status}`);
      setScreening({ for: candidate, result: (await res.json()) as Screening, error: null });
    } catch (err) {
      setScreening({
        for: candidate,
        result: null,
        error: err instanceof Error ? err.message : "the screening service could not be reached",
      });
    } finally {
      setScreeningBusy(false);
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
    touched && address !== "" && !addressCheck.valid && !looksLikeTx && !resolved && !otherChain;
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
    <div className="space-y-16">
      {/* ------------------------------------------------------------ intake */}
      {/* The page is the intake, so the form carries no section header of its
          own — the page header above already says what this is. */}
      <section aria-label="Intake">
        <form onSubmit={onSubmit} noValidate>
          <div className="grid gap-16 lg:grid-cols-[1.7fr_1fr]">
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
                  // Screened on blur only where it is the whole answer: a chain
                  // FineX does not trace. An Ethereum address offers the button.
                  if (otherChain) void screenOtherChain();
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder="T…  or 0x…  or a transaction hash"
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
                    ? addressCheck.chain === "ethereum"
                      ? `${addressCheck.checksummed ? "Checksum valid" : "Well formed, typed without a checksum, so a mistyped character cannot be caught"}. ${chainMeta("ethereum").note}`
                      : "Checksum valid — the address is well formed."
                    : looksLikeTx
                      ? resolving
                        ? "Reading the transaction…"
                        : "That is a transaction hash. We will read it and trace the wallet it paid."
                      : otherChain
                        ? `${otherChain.chain.name} address${otherChain.verified ? ", checksum valid" : ""}. FineX traces USDT on TRON and Ethereum; an address on another chain is screened against the OFAC sanctions list instead.`
                        : "A TRON address (T…), an Ethereum address (0x…), or the hash of the transaction that sent the money."}
              </p>

              {/* What the hash turned out to be, stated before anything is
                  traced. An officer has to be able to see that the wallet we
                  are about to follow is the one their transaction paid. */}
              {resolved ? (
                <div className="mt-6 border-l-2 border-confirmed py-4 pl-6">
                  <Designation>Transaction read</Designation>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    This {chainMeta(resolved.chain).name} transaction moved{" "}
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

              {/* Another chain: screened, never traced. Listed is a finding; not
                  listed is stated as exactly that and nothing more. */}
              {screenable && !screened ? (
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => void screenOtherChain()}
                    disabled={screeningBusy}
                    className={buttonStyles.secondary}
                  >
                    {screeningBusy ? (
                      <>
                        <Spinner /> Screening
                      </>
                    ) : (
                      "Screen against OFAC"
                    )}
                  </button>
                </div>
              ) : null}

              {screened ? <ScreeningResult screened={screened} /> : null}

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
              <dl className="mt-4 divide-y divide-line border-y border-line">
                {PARAMETERS.map(([term, value]) => (
                  <div key={term} className="flex items-baseline gap-6 py-2">
                    <dt className="w-24 shrink-0 font-label text-xs uppercase tracking-[0.16em] text-faint">
                      {term}
                    </dt>
                    <dd className="text-xs leading-5 text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-5 text-faint">
                Fixed limits: every case file is traced the same way, so any two
                are comparable.
              </p>
            </aside>
          </div>
        </form>
      </section>

      {/* ----------------------------------------------------------- results */}
      {/* Straight under the form that asked for it. It used to render below the
          recorded examples, so an officer scrolled past three sample cases to
          read their own. */}
      {status.kind === "running" ? (
        <TraceSkeleton address={address} events={status.events} />
      ) : null}

      {status.kind === "failed" ? (
        <ErrorState
          title="The trace did not run"
          description={`${status.message} With demo mode on, the recorded cases below open from their files without touching the network.`}
        />
      ) : null}

      {status.kind === "done" ? (
        <div className="border-t border-line pt-10">
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

      {/* -------------------------------------------------------- case files */}
      <section>
        <SectionHeader title="Recorded traces" kicker="Captured from the chain" />
        <ul className="mt-10 divide-y divide-line border-y border-line">
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
        <p className="mt-4 max-w-2xl text-xs leading-5 text-faint">
          Each opens as it was read on 14 September 2026, so it shows the same
          case today. Any other address is read live, in about half a minute.
        </p>
      </section>

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
