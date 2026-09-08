"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_SAMPLES, getTrace, type Sourced } from "@/lib/api";
import type { TraceResult } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import TraceView from "./TraceView";
import { ErrorState, Panel, Skeleton, Spinner, TriageBadge, buttonStyles } from "./ui";

export function TraceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-line pb-6">
        <Spinner className="text-brand" />
        <p className="text-sm text-muted">Loading trace…</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <div className="space-y-4">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      </div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

/** The "no trace for this address" screen, with one-click samples. */
export function NoTraceState({
  address,
  message,
  onRetry,
}: {
  address: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-5">
      <ErrorState
        title={`No trace available for ${shortAddress(address, 8, 6)}`}
        description={message}
        action={
          onRetry ? (
            <button type="button" onClick={onRetry} className={buttonStyles.secondary}>
              Try again
            </button>
          ) : undefined
        }
      />
      <Panel
        title="Addresses with a committed trace"
        subtitle="These three run with the backend offline — they are the frozen demo cases."
      >
        <ul className="grid gap-3 sm:grid-cols-3">
          {DEMO_SAMPLES.map((s) => (
            <li key={s.address}>
              <Link
                href={`/trace/${s.address}`}
                className="block h-full rounded-xl border border-line bg-surface-2/60 p-4 transition hover:border-brand/40"
              >
                <TriageBadge level={s.triage} />
                <p className="mt-2.5 text-sm leading-6 text-ink">{s.headline}</p>
                <p className="mt-1 font-mono text-[11px] text-faint">
                  {shortAddress(s.address, 10, 8)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * One loaded trace, tagged with the address and attempt it belongs to.
 *
 * Tagging is what keeps this loader honest: the result is only rendered when it
 * matches what is being asked for right now, so nothing has to be reset in an
 * effect and a stale response can never paint over a newer request.
 */
export type LoadedTrace = { address: string; attempt: number } & (
  | { status: "ready"; result: Sourced<TraceResult> }
  | { status: "error"; message: string }
);

/** Fetches a trace and reports it back, tagged. Used by every trace screen. */
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
      .then((result) => {
        if (!cancelled) setLoaded({ address, attempt, status: "ready", result });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            address,
            attempt,
            status: "error",
            message: describeError(err, "The trace could not be loaded."),
          });
        }
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
 * here, so the loading, demo-fallback and failure states are identical
 * everywhere and only have to be right once.
 */
export default function TraceLoader({ address }: { address: string }) {
  const { current, retry } = useTrace(address);

  if (!current) return <TraceSkeleton />;
  if (current.status === "error") {
    return <NoTraceState address={address} message={current.message} onRetry={retry} />;
  }
  return (
    <TraceView
      trace={current.result.data}
      source={current.result.source}
      note={current.result.note}
    />
  );
}
