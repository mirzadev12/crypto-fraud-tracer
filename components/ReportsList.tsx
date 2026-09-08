"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCases, type Sourced } from "@/lib/api";
import type { CaseSummary } from "@/lib/types";
import { formatDate, formatUsdt } from "@/lib/format";
import AddressChip from "./AddressChip";
import {
  DataSourceBadge,
  EmptyState,
  ErrorState,
  Panel,
  Skeleton,
  TriageBadge,
  buttonStyles,
} from "./ui";

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

  if (state.status === "loading") {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState title="Reports could not be loaded" description={state.message} />
    );
  }

  const cases = state.result.data;

  return (
    <Panel
      title="Evidence packets"
      subtitle="One per complaint. Each packet is print-ready and states its own limitations."
      actions={<DataSourceBadge source={state.result.source} note={state.result.note} />}
    >
      {cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          description="Run a trace from the Investigate screen and its evidence packet will appear here."
          action={
            <Link href="/investigate" className={buttonStyles.primary}>
              New investigation
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cases.map((c) => (
            <li
              key={c.caseId}
              className="flex flex-col border border-line bg-surface-2/50 p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-faint">{c.caseId}</span>
                <TriageBadge level={c.triage} />
              </div>

              <div className="mt-4">
                <AddressChip address={c.inputAddress} tone="strong" explorer={false} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                    Reported
                  </dt>
                  <dd className="mt-1 font-mono text-ink">
                    {formatUsdt(c.reportedAmountUsdt, { symbol: false })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                    Destination
                  </dt>
                  <dd className="mt-1 truncate text-muted">
                    {c.terminalEntity ?? "Funds at rest"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-4">
                <span className="text-xs text-faint">
                  Fraud reported {formatDate(c.fraudDate)}
                </span>
                <Link
                  href={`/report/${encodeURIComponent(c.inputAddress)}`}
                  className="border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-brass/40 hover:text-brass"
                >
                  Open packet
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
