"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCases, summarize, type Sourced } from "@/lib/api";
import type { CaseSummary, TriageLevel } from "@/lib/types";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import AddressChip from "./AddressChip";
import {
  DataSourceBadge,
  EmptyState,
  ErrorState,
  Panel,
  Skeleton,
  StatCard,
  TRIAGE_META,
  TriageBadge,
  buttonStyles,
} from "./ui";

type Filter = "ALL" | TriageLevel;

const FILTERS: Filter[] = ["ALL", "HOT", "WARM", "COLD"];

/** A stable empty array, so the memo dependencies below do not change every render. */
const NO_CASES: CaseSummary[] = [];

/** HOT first: the queue is ordered by what still has recoverable money. */
const TRIAGE_ORDER: Record<TriageLevel, number> = { HOT: 0, WARM: 1, COLD: 2 };

export default function CaseQueue() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; result: Sourced<CaseSummary[]> }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCases()
      .then((result) => !cancelled && setState({ status: "ready", result }))
      .catch((err: unknown) =>
        !cancelled &&
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load the case queue.",
        }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const cases = state.status === "ready" ? state.result.data : NO_CASES;

  const stats = useMemo(() => summarize(cases), [cases]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) => (filter === "ALL" ? true : c.triage === filter))
      .filter((c) =>
        q
          ? c.caseId.toLowerCase().includes(q) ||
            c.inputAddress.toLowerCase().includes(q) ||
            (c.terminalEntity ?? "").toLowerCase().includes(q)
          : true,
      )
      .sort(
        (a, b) =>
          TRIAGE_ORDER[a.triage] - TRIAGE_ORDER[b.triage] ||
          new Date(b.fraudDate).getTime() - new Date(a.fraudDate).getTime(),
      );
  }, [cases, filter, query]);

  if (state.status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState
        title="The case queue could not be loaded"
        description={state.message}
        action={
          <button
            type="button"
            onClick={() => location.reload()}
            className={buttonStyles.secondary}
          >
            Reload
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Act now (HOT)"
          value={String(stats.hot)}
          hint="Funds still at rest — no off-ramp reached"
          tone="hot"
        />
        <StatCard
          label="Freeze viable (WARM)"
          value={String(stats.warm)}
          hint="Deposit address named — freeze request can be filed"
          tone="warm"
        />
        <StatCard
          label="Closed (COLD)"
          value={String(stats.cold)}
          hint="Path enters a mixer or sanctioned address"
          tone="cold"
        />
        <StatCard
          label="Still actionable"
          value={formatUsdt(stats.recoverableUsdt, { symbol: false })}
          hint={`USDT across ${stats.hot + stats.warm} of ${stats.total} complaints`}
          tone="brand"
        />
      </div>

      <Panel
        title="Complaint queue"
        subtitle="Ordered by whether the money can still be reached, not by when it was reported."
        actions={
          <DataSourceBadge source={state.result.source} note={state.result.note} />
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex rounded-lg border border-line bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                  filter === f
                    ? f === "ALL"
                      ? "bg-white/10 text-ink"
                      : `${TRIAGE_META[f].chip} border`
                    : "text-faint hover:text-ink"
                }`}
              >
                {f === "ALL" ? "All" : f}
              </button>
            ))}
          </div>

          <label className="relative ml-auto w-full sm:w-72">
            <span className="sr-only">Search cases</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID, address or exchange"
              className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink placeholder:text-faint focus:border-brand/50 focus:outline-none"
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No complaints match this filter"
              description="Clear the search or switch the triage filter to see the rest of today's queue."
            />
          </div>
        ) : (
          <div className="tx-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-5 py-3 font-medium">Triage</th>
                  <th className="px-5 py-3 font-medium">Case</th>
                  <th className="px-5 py-3 font-medium">Victim-reported address</th>
                  <th className="px-5 py-3 font-medium">Destination</th>
                  <th className="px-5 py-3 text-right font-medium">Reported</th>
                  <th className="px-5 py-3 font-medium">Reported at</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.caseId}
                    className="border-b border-line-soft transition last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3.5">
                      <TriageBadge level={c.triage} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted">
                      {c.caseId}
                    </td>
                    <td className="px-5 py-3.5">
                      <AddressChip address={c.inputAddress} explorer={false} />
                    </td>
                    <td className="px-5 py-3.5">
                      {c.terminalEntity ? (
                        <span className="text-ink">{c.terminalEntity}</span>
                      ) : (
                        <span className="text-faint">Funds at rest</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink">
                      {formatUsdt(c.reportedAmountUsdt, { symbol: false })}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted">
                      {formatDateTime(c.fraudDate)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/trace/${encodeURIComponent(c.inputAddress)}`}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand/40 hover:text-brand"
                        aria-label={`Open trace for case ${c.caseId}, address ${shortAddress(c.inputAddress)}`}
                      >
                        Open trace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
