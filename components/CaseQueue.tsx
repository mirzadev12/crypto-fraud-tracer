"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCases, isIllustrative, summarize, type Sourced } from "@/lib/api";
import type { CaseSummary, TriageLevel } from "@/lib/types";
import { formatDate, formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
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

  /*
   * The headline figures count the real cases only. The register also lists
   * illustrative rows, each tagged, and summing them in put 251,650 USDT of
   * hand-built cases into a 289,098.90 "still actionable" — a figure a reader
   * takes for the desk's real exposure. The rows stay; the arithmetic does not
   * include them, and the caption under the figures says so.
   */
  const realCases = useMemo(() => cases.filter((c) => !isIllustrative(c.inputAddress)), [cases]);
  const illustrativeCount = cases.length - realCases.length;
  const stats = useMemo(() => summarize(realCases), [realCases]);

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
          b.reportedAmountUsdt - a.reportedAmountUsdt ||
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
          label="Critical"
          value={String(stats.hot)}
          hint="Funds still at rest — no exit reached"
          tone="hot"
        />
        <StatCard
          label="Suspicious"
          value={String(stats.warm)}
          hint="Exit identified — freeze request viable"
          tone="warm"
        />
        <StatCard
          label="Closed"
          value={String(stats.cold)}
          hint="Trail enters a mixer or sanctioned address"
          tone="cold"
        />
        <StatCard
          label="Still actionable"
          value={formatUsdt(stats.recoverableUsdt, { symbol: false })}
          hint={`USDT across ${stats.hot + stats.warm} of ${stats.total} recorded cases`}
          tone="brand"
        />
      </div>
      {illustrativeCount > 0 ? (
        <p className="text-xs leading-5 text-faint">
          These figures count the {stats.total} recorded cases. The {illustrativeCount}{" "}
          illustrative rows in the register below are listed and marked, but not counted.
        </p>
      ) : null}

      {/* The order is stated once, in the page header above; the chain the
          whole register is on is stated here instead of in a column that read
          TRON on every row. */}
      <Panel
        title="Complaint queue"
        actions={
          <DataSourceBadge
          source={state.result.source}
          note={state.result.note}
          label="Committed register"
        />
        }
        code="TRON · USDT TRC-20"
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-line-soft px-6 py-4">
          <div className="flex flex-wrap border border-line bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] ${
                  filter === f
                    ? f === "ALL"
                      ? "fx-option-quiet fx-option-on bg-white/10 text-ink"
                      : `${TRIAGE_META[f].chip} border`
                    : "fx-option-quiet text-faint hover:text-brass"
                }`}
              >
                {f === "ALL" ? "All" : TRIAGE_META[f].label}
              </button>
            ))}
          </div>

          <label className="relative ml-auto w-full sm:w-72">
            <span className="sr-only">Search cases</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case, wallet or destination"
              className="w-full border border-line bg-surface-2 px-4 py-2 text-sm text-ink placeholder:text-faint focus:border-brass/50 focus:outline-none"
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No complaints match this filter"
              description="Clear the search or switch the triage filter to see the rest of today's queue."
            />
          </div>
        ) : (
          <div className="fx-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-faint">
                  <th className="px-6 py-4 font-normal">Case</th>
                  <th className="px-6 py-4 font-normal">Wallet</th>
                  <th className="px-6 py-4 text-right font-normal">Amount</th>
                  <th className="px-6 py-4 font-normal">Status</th>
                  <th className="px-6 py-4 font-normal">Reported</th>
                  <th className="px-6 py-4 font-normal">Destination</th>
                  {/* relative: sr-only text is absolutely positioned, and without a
                      positioned cell to hold it, it escapes the table's scroll
                      box and widens the whole page on a phone. */}
                  <th className="relative px-6 py-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  /* One line per case. The date wrapped to three lines and set
                     every row's height; the icons and the Open control stay out
                     of the way until the row is pointed at. */
                  <tr
                    key={c.caseId}
                    className="group border-b border-line-soft transition last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-6 py-2 font-mono text-xs whitespace-nowrap text-muted">
                      {c.caseId}
                      {isIllustrative(c.inputAddress) ? (
                        <span
                        className="ml-2 font-label text-[10px] uppercase tracking-[0.16em] text-faint"
                        title="Illustrative — an address generated for this repository to show a shape, never on the TRON chain."
                      >
                        Illustrative
                      </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-2">
                      <AddressChip address={c.inputAddress} explorer={false} quiet />
                    </td>
                    <td className="px-6 py-2 text-right font-mono tabular-nums text-ink">
                      {formatUsdt(c.reportedAmountUsdt, { symbol: false })}
                    </td>
                    <td className="px-6 py-2">
                      <TriageBadge level={c.triage} />
                    </td>
                    <td className="px-6 py-2 font-mono text-xs whitespace-nowrap text-faint" title={formatDateTime(c.fraudDate)}>
                      {formatDate(c.fraudDate)}
                    </td>
                    <td className="px-6 py-2 text-sm">
                      {c.terminalEntity ? (
                        <span className="text-ink">{c.terminalEntity}</span>
                      ) : (
                        <span className="text-faint">Funds at rest</span>
                      )}
                    </td>
                    <td className="px-6 py-2 text-right">
                      <Link
                        href={`/trace/${encodeURIComponent(c.inputAddress)}`}
                        className="inline-block fx-option-quiet px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint group-hover:text-brass hover:text-brass"
                        aria-label={`Open for case ${c.caseId}, address ${shortAddress(c.inputAddress)}`}
                      >
                        Open
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
