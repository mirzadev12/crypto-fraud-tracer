"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_SAMPLES, runTrace, traceHref, type TraceLookup } from "@/lib/api";
import { checkTronAddress } from "@/lib/tron";
import { shortAddress } from "@/lib/format";
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
  "w-full border-0 border-b bg-transparent px-0 py-4 font-mono text-ink placeholder:text-dim";

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

  const addressCheck = useMemo(() => checkTronAddress(address), [address]);
  const amountValue = Number(amount);
  // Amount and date are both optional; only a malformed amount blocks a run.
  const amountValid =
    amount.trim() === "" || (Number.isFinite(amountValue) && amountValue > 0);
  const canSubmit = addressCheck.valid && amountValid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setStatus({ kind: "running", events: [] });
    try {
      const result = await runTrace(
        {
          address: address.trim(),
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

  function applySample(sampleAddress: string) {
    const sample = DEMO_SAMPLES.find((s) => s.address === sampleAddress);
    setAddress(sampleAddress);
    setTouched(false);
    setStatus({ kind: "idle" });
    // Pre-fill values that match the committed fixture so the run is coherent.
    if (sample) {
      const presets: Record<string, { amount: string; date: string }> = {
        [DEMO_SAMPLES[0].address]: { amount: "51200", date: "2026-08-29" },
        [DEMO_SAMPLES[1].address]: { amount: "18500", date: "2026-09-06" },
        [DEMO_SAMPLES[2].address]: { amount: "240000", date: "2026-08-21" },
      };
      const preset = presets[sampleAddress];
      if (preset) {
        setAmount(preset.amount);
        setFraudDate(preset.date);
      }
    }
  }

  const showAddressError = touched && address !== "" && !addressCheck.valid;
  const showAmountError = touched && amount !== "" && !amountValid;

  return (
    <div className="space-y-24">
      {/* ------------------------------------------------------------ intake */}
      <section>
        <SectionHeader index="01" title="Intake" kicker="From the complaint" />

        <form onSubmit={onSubmit} noValidate>
          <div className="mt-16 grid gap-16 lg:grid-cols-[1.7fr_1fr]">
            <div>
              <label htmlFor="address">
                <Designation>Victim-reported address</Designation>
              </label>
              <input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => setTouched(true)}
                spellCheck={false}
                autoComplete="off"
                placeholder="T…"
                aria-invalid={showAddressError}
                aria-describedby="address-help"
                className={`${FIELD} mt-4 text-lg tracking-tight md:text-xl ${
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
                    : "34 characters, starts with T. The checksum is verified here before anything is sent."}
              </p>

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
              <button
                type="button"
                onClick={() => applySample(s.address)}
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
                  Load
                  <Diamond className="bg-brass-dim" size={4} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
          Any other address is read live from the chain. A live trace takes
          roughly half a minute — it is doing the same work as the recorded
          cases above, against whatever the wallet is doing today.
        </p>
      </section>

      {/* ----------------------------------------------------------- results */}
      {status.kind === "running" ? (
        <TraceSkeleton address={address} events={status.events} />
      ) : null}

      {status.kind === "failed" ? (
        <ErrorState
          title="The trace did not run"
          description={`${status.message} The recorded cases below run without touching the network, if this needs to be shown now.`}
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
    </div>
  );
}
