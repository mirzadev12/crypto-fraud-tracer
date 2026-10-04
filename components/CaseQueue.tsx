"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { caseHref, getCases, isIllustrative, rowChain, summarize, type Sourced } from "@/lib/api";
import { ChainScope } from "./ChainScope";
import type { CaseSummary, TriageLevel } from "@/lib/types";
import { formatDate, formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import AddressChip from "./AddressChip";
import { ORIGIN, extras } from "@/lib/register-origin";
import Inr from "./Inr";
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
import { chainMeta, chainOf } from "@/lib/chain-meta";

type Filter = "ALL" | TriageLevel;

const FILTERS: Filter[] = ["ALL", "HOT", "WARM", "COLD"];

/** A stable empty array, so the memo dependencies below do not change every render. */
const NO_CASES: CaseSummary[] = [];

const rowKey = (c: CaseSummary) => `${extras(c).chain ?? chainOf(c.inputAddress)}:${c.inputAddress}`;

/** Poll fast while the server is re-reading, slowly otherwise. */
const POLL_ACTIVE_MS = 20_000;
const POLL_IDLE_MS = 120_000;

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      getCases()
        .then((result) => {
          if (cancelled) return;
          setState({ status: "ready", result });
          const busy = result.register?.reference.running;
          timer = setTimeout(load, busy ? POLL_ACTIVE_MS : POLL_IDLE_MS);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState((prev) =>
            prev.status === "ready"
              ? prev
              : { status: "error", message: err instanceof Error ? err.message : "Could not load the case queue." },
          );
          timer = setTimeout(load, POLL_IDLE_MS);
        });
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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
  // The chain is stated once in the header when the whole register is on one;
  // when it holds both, each row says which, since a 0x address and a T address
  // are traced on different chains.
  const mixedChains = useMemo(
    () => new Set(cases.map((c) => rowChain(c) ?? chainOf(c.inputAddress))).size > 1,
    [cases],
  );
  const registerScope = mixedChains
    ? `${[...new Set(cases.map((c) => chainMeta(rowChain(c) ?? chainOf(c.inputAddress)).name))].join(" · ")} · USDT`
    : chainMeta(chainOf(cases[0]?.inputAddress ?? "T")).scope;
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

  /*
   * When a live read lands and the order changes, each row moves from where it
   * was to where it now belongs (FLIP), instead of the table jumping under the
   * reader's eye. Measured after the DOM updates, before paint. Under reduced
   * motion the rows simply take their new places.
   */
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const lastTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tops = new Map<string, number>();
    for (const [k, el] of rowEls.current) tops.set(k, el.getBoundingClientRect().top);
    if (!reduce) {
      for (const [k, el] of rowEls.current) {
        const before = lastTops.current.get(k);
        const after = tops.get(k);
        if (before === undefined || after === undefined || Math.abs(before - after) < 1) continue;
        el.animate([{ transform: `translateY(${before - after}px)` }, { transform: "translateY(0)" }], {
          duration: 320,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        });
      }
    }
    lastTops.current = tops;
  }, [rows]);

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
          hint={`USDT across ${stats.hot + stats.warm} of ${stats.total} cases in the register`}
          aside={<Inr usdt={stats.recoverableUsdt} />}
          tone="brand"
        />
      </div>
      <RegisterCaption result={state.result} cases={cases} illustrativeCount={illustrativeCount} />

      {/* The order is stated once, in the page header above; the chain the
          whole register is on is stated here instead of in a column that read
          TRON on every row. */}
      <Panel
        title="Complaint queue"
        actions={
          <DataSourceBadge
          source={state.result.source}
          note={state.result.note}
          label={state.result.register?.mode === "live" ? "Live register" : "Recorded register"}
        />
        }
        code={registerScope}
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
                {rows.map((c) => {
                  const k = rowKey(c);
                  const origin = ORIGIN[extras(c).origin ?? ""];
                  const readAt = extras(c).readAt;
                  const by = extras(c).by;
                  return (
                  /* One line per case. The date wrapped to three lines and set
                     every row's height; the icons and the Open control stay out
                     of the way until the row is pointed at. */
                  <tr
                    key={k}
                    ref={(el) => {
                      if (el) rowEls.current.set(k, el);
                      else rowEls.current.delete(k);
                    }}
                    className="group border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-6 py-2 font-mono text-xs whitespace-nowrap text-muted">
                      {c.caseId}
                      {origin ? (
                        <span
                          className={`ml-2 font-label text-[10px] uppercase tracking-[0.16em] ${
                            extras(c).origin === "recorded" ? "text-faint" : "text-muted"
                          }`}
                          title={[origin.title, readAt ? `read ${formatDateTime(readAt)}` : null, by]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {origin.label}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-2">
                      <ChainScope chain={rowChain(c) ?? chainOf(c.inputAddress)}>
                        <AddressChip address={c.inputAddress} explorer={false} quiet />
                      </ChainScope>
                      {mixedChains ? (
                        <span className="ml-2 font-label text-[10px] uppercase tracking-[0.16em] text-faint">
                          {chainMeta(rowChain(c) ?? chainOf(c.inputAddress)).name}
                        </span>
                      ) : null}
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
                        href={caseHref("trace", c)}
                        className="inline-block fx-option-quiet px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint group-hover:text-brass hover:text-brass"
                        aria-label={`Open for case ${c.caseId}, address ${shortAddress(c.inputAddress)}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/**
 * One sentence under the figures saying what the register is built from, with
 * the live re-read's progress while it runs. Counted from the rows themselves.
 */
function RegisterCaption({
  result,
  cases,
  illustrativeCount,
}: {
  result: Sourced<CaseSummary[]>;
  cases: CaseSummary[];
  illustrativeCount: number;
}) {
  const meta = result.register;
  const count = (origin: string) => cases.filter((c) => extras(c).origin === origin).length;
  if (!meta || meta.mode !== "live") {
    return (
      <p className="text-xs leading-5 text-faint">
        {meta
          ? `Recorded mode: these are the ${cases.length} real cases captured from the chain, served without network.`
          : "The live register could not be reached; these are the recorded cases committed with this build."}
        {illustrativeCount > 0 ? ` ${illustrativeCount} illustrative rows are listed and marked, but not counted.` : ""}
      </p>
    );
  }
  const { reference } = meta;
  const awaiting = count("recorded");
  return (
    <p className="text-xs leading-5 text-faint">
      Built from this server&rsquo;s own chain reads, each logged in the audit chain: {count("traced")} traced
      here, {count("saved")} saved, {count("reference")} recorded wallets re-read live
      {awaiting ? `, ${awaiting} awaiting their re-read` : ""}.{" "}
      {reference.running
        ? `Re-reading now: ${reference.done} of ${reference.total}.`
        : reference.lastPassAt
          ? `Last re-read finished ${formatDateTime(reference.lastPassAt)}; the next is due within six hours.`
          : reference.enabled
            ? "The first re-read starts shortly after the server starts."
            : "The scheduled re-read is off on this server."}
    </p>
  );
}
