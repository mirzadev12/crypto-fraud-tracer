"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCases, type Sourced } from "@/lib/api";
import type { CaseSummary } from "@/lib/types";
import { formatDate, formatUsdt, shortAddress } from "@/lib/format";
import {
  DataSourceBadge,
  Designation,
  Diamond,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  TriageBadge,
  buttonStyles,
} from "./ui";

/** Stable empty array so the memo below does not re-run every render. */
const NO_CASES: CaseSummary[] = [];

export default function ReportsList() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; result: Sourced<CaseSummary[]> }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCases()
      .then((result) => !cancelled && setState({ status: "ready", result }))
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load reports.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cases = state.status === "ready" ? state.result.data : NO_CASES;

  // A register is filed newest first — this is a record of documents, not a
  // work queue, so it does not reorder itself by disposition.
  const rows = useMemo(
    () =>
      [...cases].sort(
        (a, b) => new Date(b.fraudDate).getTime() - new Date(a.fraudDate).getTime(),
      ),
    [cases],
  );

  const withExit = useMemo(
    () => cases.filter((c) => c.terminalEntity !== null).length,
    [cases],
  );

  if (state.status === "loading") {
    return (
      <div className="space-y-1" aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="The register could not be loaded" description={state.message} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Register empty"
        description="Run a trace from the intake screen and its evidence packet is filed here."
        action={
          <Link href="/investigate" className={buttonStyles.primary}>
            Open a case
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <SectionHeader
        index="01"
        title="Register"
        kicker={`${rows.length} packets · ${withExit} with an exit named`}
      />

      <div className="mt-6 flex items-center justify-between gap-4">
        <Designation>Filed newest first</Designation>
        <DataSourceBadge source={state.result.source} note={state.result.note} />
      </div>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {rows.map((c) => (
          <li key={c.caseId}>
            <Link
              href={`/report/${encodeURIComponent(c.inputAddress)}`}
              className="group grid grid-cols-1 gap-4 py-6 transition hover:bg-surface lg:grid-cols-[7rem_10rem_1fr_8rem_7rem_7rem] lg:items-center lg:gap-6"
            >
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-faint transition group-hover:text-brass">
                {c.caseId}
              </span>

              <span className="font-mono text-xs text-muted" title={c.inputAddress}>
                {shortAddress(c.inputAddress, 8, 6)}
              </span>

              <span className="text-sm text-ink">
                {c.terminalEntity ?? (
                  <span className="text-faint">No exit reached — funds at rest</span>
                )}
              </span>

              <span className="font-mono text-sm tabular-nums text-ink lg:text-right">
                {formatUsdt(c.reportedAmountUsdt, { symbol: false })}
              </span>

              <span className="font-mono text-xs text-faint">
                {formatDate(c.fraudDate)}
              </span>

              <span className="flex items-center justify-between gap-4 lg:justify-end">
                <TriageBadge level={c.triage} />
                <Diamond
                  className="bg-line transition group-hover:bg-brass"
                  size={4}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
        Every packet states the finding, the basis for the attribution, the
        behavioural signals and the API responses it was built from — then states
        its own limitations in writing. Open one to print or file it.
      </p>
    </div>
  );
}
