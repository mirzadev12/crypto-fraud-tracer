"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_SAMPLES, getTrace, type TraceLookup } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import TraceView from "./TraceView";
import {
  CASE_PROOF,
  Designation,
  Diamond,
  Panel,
  SectionHeader,
  Skeleton,
  TriageBadge,
  buttonStyles,
} from "./ui";

/**
 * Loading state, written as a console log.
 *
 * IMPORTANT: these lines are display copy on a fixed timer. They are NOT backend
 * telemetry — nothing here observes the real request, and the sequence finishes
 * on its own schedule whether the fetch has resolved or not. Do not read them as
 * instrumentation, and do not wire them to one: the moment they look like a
 * live trace log, they become a claim we cannot support in front of a judge.
 */
const LOADER_STEPS: Array<{ label: string; detail: string; at: number }> = [
  { label: "resolving address", detail: "", at: 0 },
  { label: "fetching TRC-20 transfers", detail: "on-chain", at: 220 },
  { label: "tracing hops (depth 3)", detail: "", at: 480 },
  { label: "matching labels", detail: "", at: 760 },
  { label: "scoring risk", detail: "", at: 1000 },
];

export function TraceSkeleton({ address }: { address?: string } = {}) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers = LOADER_STEPS.map((step, i) =>
      setTimeout(() => setDone(i + 1), step.at + 180),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-6" aria-busy="true">
      <div className="border border-line bg-surface p-6">
        <Designation>[ tracing ]</Designation>
        <ul className="mt-4 space-y-2 font-mono text-xs">
          {LOADER_STEPS.map((step, i) => {
            const complete = i < done;
            const detail =
              i === 0 && address ? shortAddress(address, 6, 4) : step.detail;
            return (
              <li key={step.label} className={complete ? "text-ink" : "text-faint"}>
                <span aria-hidden="true">▸ </span>
                {step.label}{" "}
                <span className="text-faint">
                  {".".repeat(Math.max(2, 28 - step.label.length))}
                </span>{" "}
                {detail}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <div className="space-y-4">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      </div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

/* ------------------------------------------------------- prepared case list */

function PreparedCases() {
  return (
    <Panel
      title="Verified traces held on this build"
      subtitle="Captured from the chain, committed to the repository, and readable with the network off."
      framed={false}
    >
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {DEMO_SAMPLES.map((s) => (
          <li key={s.address}>
            <Link
              href={`/trace/${s.address}`}
              className="group flex flex-col gap-4 py-6 transition hover:bg-surface md:flex-row md:items-center md:gap-10"
            >
              <span className="w-40 shrink-0">
                <TriageBadge level={s.triage} />
              </span>
              <span className="flex-1 text-sm leading-6 text-ink">
                {CASE_PROOF[s.triage]}
              </span>
              <span className="font-mono text-xs text-faint">
                {shortAddress(s.address, 8, 6)}
              </span>
              <span className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition group-hover:text-brass">
                Open
                <Diamond className="bg-brass-dim" size={4} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* --------------------------------------------------------- unresolved state */

/**
 * A valid address we hold no trace for.
 *
 * This is a state, not a failure. It echoes the address back, confirms the
 * checksum passed, names the endpoint that would answer it, and states exactly
 * what the pipeline would do — a more useful thing to put in front of an
 * evaluator than a fixture pretending to be a live result.
 */
export function NoTraceState({
  address,
  endpoint = "POST /api/trace",
  detail,
  onRetry,
}: {
  address: string;
  endpoint?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const PIPELINE: Array<[string, string]> = [
    ["01", "Fetch every confirmed TRC-20 transfer for this address from the chain"],
    ["02", "Trace forward to depth 3, following the five largest outflows per wallet"],
    ["03", "Carry the victim's taint along each edge and drop transfers under 1%"],
    [
      "04",
      "Match every address against the label table — 11 seed wallets, 202 sanctioned addresses",
    ],
    ["05", "Score six behavioural rules, then call the disposition"],
  ];

  return (
    <div className="space-y-16">
      <section>
        <SectionHeader index="01" title="No trace held" kicker="Address accepted" />

        <div className="mt-16 grid gap-16 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Designation>Address received</Designation>
            <p className="mt-4 break-all border-b border-line pb-4 font-mono text-lg text-ink md:text-xl">
              {address}
            </p>

            <dl className="mt-10 divide-y divide-line border-y border-line">
              <div className="flex items-baseline gap-6 py-4">
                <dt className="w-32 shrink-0 font-label text-xs uppercase tracking-[0.16em] text-confirmed">
                  Valid
                </dt>
                <dd className="text-sm leading-6 text-muted">
                  34 characters, TRON mainnet prefix, <strong className="font-semibold text-ink">base58check verified</strong> in the
                  browser. The input was read, not matched against a list.
                </dd>
              </div>
              <div className="flex items-baseline gap-6 py-4">
                <dt className="w-32 shrink-0 font-label text-xs uppercase tracking-[0.16em] text-suspicious">
                  No trace
                </dt>
                <dd className="text-sm leading-6 text-muted">
                  {detail ?? "The trace service is not deployed on this build."} It
                  answers on <code className="font-mono text-ink">{endpoint}</code>.
                  No recorded trace is held for this address, and this build will
                  not show another address&rsquo;s result in its place.
                </dd>
              </div>
            </dl>

            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className={`${buttonStyles.secondary} mt-10`}
              >
                Try again
              </button>
            ) : null}
          </div>

          <aside>
            <Designation>What the pipeline would do</Designation>
            <ol className="mt-6 divide-y divide-line border-y border-line">
              {PIPELINE.map(([n, text]) => (
                <li key={n} className="flex items-baseline gap-4 py-4">
                  <span className="font-mono text-xs text-brass">{n}</span>
                  <span className="text-xs leading-6 text-muted">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs leading-6 text-faint">
              The label table and the six rules are in the repository now. The
              service that runs them over live chain data is the piece still to be
              deployed.
            </p>
          </aside>
        </div>
      </section>

      <PreparedCases />
    </div>
  );
}

/* ------------------------------------------------------------ invalid state */

/** A malformed address. Deliberately a different screen from "no trace held". */
export function InvalidAddressState({
  address,
  reason,
}: {
  address: string;
  reason: string;
}) {
  return (
    <div className="space-y-16">
      <section>
        <SectionHeader index="01" title="Address rejected" kicker="Failed validation" />
        <div className="mt-16 max-w-2xl">
          <Designation>Address received</Designation>
          <p className="mt-4 break-all border-b border-critical pb-4 font-mono text-lg text-ink md:text-xl">
            {address || "—"}
          </p>
          <p className="mt-6 text-sm leading-7 text-critical">{reason}</p>
          <p className="mt-6 text-sm leading-7 text-muted">
            Nothing was sent anywhere. A TRON address is 34 characters, begins with
            T, and carries a four-byte checksum verified in the browser before any
            request is made — so a mistyped character is caught here rather than
            costing a call to the chain.
          </p>
          <Link href="/investigate" className={`${buttonStyles.secondary} mt-10`}>
            Back to intake
          </Link>
        </div>
      </section>

      <PreparedCases />
    </div>
  );
}

export function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * One loaded lookup, tagged with the address and attempt it belongs to.
 *
 * Tagging is what keeps this loader honest: the result is only rendered when it
 * matches what is being asked for right now, so nothing has to be reset in an
 * effect and a stale response can never paint over a newer request.
 */
export type LoadedTrace = {
  address: string;
  attempt: number;
  lookup: TraceLookup;
};

export function useTrace(address: string | null): {
  current: LoadedTrace | null;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedTrace | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getTrace(address)
      .then((lookup) => {
        if (!cancelled) setLoaded({ address, attempt, lookup });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({
          address,
          attempt,
          lookup: {
            status: "unresolved",
            address,
            endpoint: "GET /api/trace/[address]",
            detail: describeError(err, "The trace could not be loaded."),
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [address, attempt]);

  const current =
    loaded && loaded.address === address && loaded.attempt === attempt ? loaded : null;

  return { current, retry: () => setAttempt((a) => a + 1) };
}

/**
 * Loads one trace and renders it. Every screen that shows a trace goes through
 * here, so loading, recorded-trace, unresolved and invalid states are identical
 * everywhere and only have to be right once.
 */
export default function TraceLoader({ address }: { address: string }) {
  const { current, retry } = useTrace(address);

  if (!current) return <TraceSkeleton address={address} />;

  const { lookup } = current;
  if (lookup.status === "invalid") {
    return <InvalidAddressState address={lookup.address} reason={lookup.reason} />;
  }
  if (lookup.status === "unresolved") {
    return (
      <NoTraceState
        address={lookup.address}
        endpoint={lookup.endpoint}
        detail={lookup.detail}
        onRetry={retry}
      />
    );
  }
  return <TraceView trace={lookup.data} source={lookup.source} note={lookup.note} />;
}
