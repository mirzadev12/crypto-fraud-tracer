"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_SAMPLES, runTrace, type Sourced } from "@/lib/api";
import type { TraceResult } from "@/lib/types";
import { checkTronAddress } from "@/lib/tron";
import { shortAddress, toDateInputValue } from "@/lib/format";
import TraceView from "./TraceView";
import { TraceSkeleton } from "./TraceLoader";
import { Chip, ErrorState, Panel, Spinner, TriageBadge, buttonStyles } from "./ui";

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: Sourced<TraceResult> }
  | { kind: "failed"; message: string };

const FIELD =
  "w-full rounded-xl border bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-faint focus:outline-none";

export default function InvestigateForm() {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [fraudDate, setFraudDate] = useState(toDateInputValue(new Date().toISOString()));
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const addressCheck = useMemo(() => checkTronAddress(address), [address]);
  const amountValue = Number(amount);
  const amountValid = amount === "" ? false : Number.isFinite(amountValue) && amountValue > 0;
  const canSubmit = addressCheck.valid && amountValid && Boolean(fraudDate);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setStatus({ kind: "running" });
    try {
      const result = await runTrace({
        address: address.trim(),
        amount: amountValue,
        // Send a full ISO timestamp — the backend filters transfers by it.
        fraudDate: new Date(`${fraudDate}T00:00:00.000Z`).toISOString(),
      });
      setStatus({ kind: "done", result });
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

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="New investigation"
          subtitle="Paste the wallet address from the NCRP complaint."
          className="lg:col-span-2"
        >
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-faint"
              >
                Victim-reported TRON address
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
                className={`${FIELD} font-mono ${
                  showAddressError
                    ? "border-hot/60"
                    : addressCheck.valid
                      ? "border-brand/40"
                      : "border-line focus:border-brand/50"
                }`}
              />
              <p
                id="address-help"
                className={`mt-2 text-xs leading-5 ${showAddressError ? "text-hot" : "text-faint"}`}
              >
                {showAddressError
                  ? addressCheck.reason
                  : addressCheck.valid
                    ? "Checksum valid."
                    : "34 characters, starts with T. The checksum is verified before anything is sent."}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-faint"
                >
                  Reported amount (USDT)
                </label>
                <input
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setTouched(true)}
                  inputMode="decimal"
                  placeholder="51200"
                  aria-invalid={touched && amount !== "" && !amountValid}
                  className={`${FIELD} font-mono ${
                    touched && amount !== "" && !amountValid
                      ? "border-hot/60"
                      : "border-line focus:border-brand/50"
                  }`}
                />
                <p className="mt-2 text-xs leading-5 text-faint">
                  Transfers below 1% of this are dropped from the trace.
                </p>
              </div>

              <div>
                <label
                  htmlFor="fraudDate"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-faint"
                >
                  Date of fraud
                </label>
                <input
                  id="fraudDate"
                  type="date"
                  value={fraudDate}
                  onChange={(e) => setFraudDate(e.target.value)}
                  className={`${FIELD} border-line font-mono focus:border-brand/50`}
                />
                <p className="mt-2 text-xs leading-5 text-faint">
                  Only transfers after this date are followed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                type="submit"
                disabled={!canSubmit || status.kind === "running"}
                className={buttonStyles.primary}
              >
                {status.kind === "running" ? (
                  <>
                    <Spinner /> Tracing…
                  </>
                ) : (
                  "Run trace"
                )}
              </button>
              {status.kind === "done" ? (
                <Link
                  href={`/trace/${encodeURIComponent(status.result.data.inputAddress)}`}
                  className={buttonStyles.secondary}
                >
                  Permalink
                </Link>
              ) : null}
              <p className="text-xs text-faint">
                Depth 3 · top 5 outflows per wallet · stops at the first labelled
                address.
              </p>
            </div>
          </form>
        </Panel>

        <Panel
          title="Frozen demo cases"
          subtitle="These run with the backend offline."
        >
          <ul className="space-y-3">
            {DEMO_SAMPLES.map((s) => (
              <li key={s.address}>
                <button
                  type="button"
                  onClick={() => applySample(s.address)}
                  className="w-full rounded-xl border border-line bg-surface-2/60 p-4 text-left transition hover:border-brand/40"
                >
                  <TriageBadge level={s.triage} />
                  <p className="mt-2.5 text-sm leading-6 text-ink">{s.headline}</p>
                  <p className="mt-1 font-mono text-[11px] text-faint">
                    {shortAddress(s.address, 10, 8)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-faint">
            Any other address is traced live against TronGrid once the trace API is
            deployed.
          </p>
        </Panel>
      </div>

      {status.kind === "running" ? <TraceSkeleton /> : null}

      {status.kind === "failed" ? (
        <ErrorState
          title="The trace did not run"
          description={status.message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip tone="neutral">
                Try one of the frozen demo addresses while the API is offline
              </Chip>
            </div>
          }
        />
      ) : null}

      {status.kind === "done" ? (
        <div className="tx-enter border-t border-line pt-6">
          <TraceView
            trace={status.result.data}
            source={status.result.source}
            note={status.result.note}
          />
        </div>
      ) : null}
    </div>
  );
}
