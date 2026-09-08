"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/api";
import type { CaseSummary } from "@/lib/types";
import {
  formatDateTime,
  formatPercent,
  formatUsdt,
  formatUsdtCompact,
  shortAddress,
} from "@/lib/format";
import AddressChip from "./AddressChip";
import TraceCanvas from "./TraceCanvas";
import { NoTraceState, useTrace } from "./TraceLoader";
import {
  Chip,
  DataSourceBadge,
  EmptyState,
  Panel,
  Skeleton,
  SourceChip,
  TriageBadge,
  buttonStyles,
} from "./ui";

/** Ordering matches the case queue: whatever still has money comes first. */
const TRIAGE_ORDER = { HOT: 0, WARM: 1, COLD: 2 } as const;

export default function FundFlowExplorer({
  initialAddress,
}: {
  initialAddress?: string;
}) {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [address, setAddress] = useState<string | null>(initialAddress ?? null);
  // Selection is tagged with the address it belongs to, so switching cases
  // clears the inspector without an effect having to reset it.
  const [selection, setSelection] = useState<{ address: string; node: string } | null>(
    null,
  );

  const { current, retry } = useTrace(address);

  useEffect(() => {
    let cancelled = false;
    getCases()
      .then(({ data }) => {
        if (cancelled) return;
        setCases(
          [...data].sort((a, b) => TRIAGE_ORDER[a.triage] - TRIAGE_ORDER[b.triage]),
        );
      })
      .catch(() => {
        /* The rail is a convenience; the graph still works without it. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function open(next: string) {
    setAddress(next);
    // Keep the URL shareable without a full navigation.
    router.replace(`/fund-flow?address=${encodeURIComponent(next)}`, { scroll: false });
  }

  const selectedNode =
    selection && selection.address === address ? selection.node : null;

  const trace = current?.status === "ready" ? current.result : null;
  const selected =
    trace && selectedNode
      ? (trace.data.nodes.find((n) => n.address === selectedNode) ?? null)
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ------------------------------------------------------------- rail */}
      <Panel
        title="Cases"
        subtitle="Pick a complaint to load its flow."
        bodyClassName="p-0"
        className="lg:sticky lg:top-24 lg:self-start"
      >
        <ul className="tx-scroll max-h-[70vh] divide-y divide-line-soft overflow-y-auto">
          {cases.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="p-4">
                  <Skeleton className="h-12" />
                </li>
              ))
            : cases.map((c) => {
                const active = c.inputAddress === address;
                return (
                  <li key={c.caseId}>
                    <button
                      type="button"
                      onClick={() => open(c.inputAddress)}
                      className={`w-full px-4 py-3.5 text-left transition ${
                        active ? "bg-brand/[0.08]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <TriageBadge level={c.triage} />
                        <span className="font-mono text-[10px] text-faint">
                          {c.caseId}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-muted">
                        {shortAddress(c.inputAddress, 8, 6)}
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-faint">
                        <span>{c.terminalEntity ?? "Funds at rest"}</span>
                        <span className="font-mono">
                          {formatUsdtCompact(c.reportedAmountUsdt)}
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
        </ul>
      </Panel>

      {/* ------------------------------------------------------------ graph */}
      <div className="space-y-5">
        {!address ? (
          <Panel title="Fund flow">
            <EmptyState
              title="Select a case to draw its fund flow"
              description="The graph reads left to right: the victim-reported wallet, every hop the money took, and the address where the trail ends."
              action={
                <Link href="/investigate" className={buttonStyles.secondary}>
                  Or trace a new address
                </Link>
              }
            />
          </Panel>
        ) : !current ? (
          <Skeleton className="h-[620px]" />
        ) : current.status === "error" ? (
          <NoTraceState address={address} message={current.message} onRetry={retry} />
        ) : (
          <>
            <Panel
              title="Fund flow"
              subtitle={`${current.result.data.nodes.length} wallets · ${current.result.data.edges.length} transfers · ${current.result.data.caseId}`}
              actions={
                <div className="flex items-center gap-2">
                  <DataSourceBadge
                    source={current.result.source}
                    note={current.result.note}
                  />
                  <TriageBadge level={current.result.data.triage} />
                  <Link
                    href={`/trace/${encodeURIComponent(current.result.data.inputAddress)}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand/40 hover:text-brand"
                  >
                    Full result
                  </Link>
                </div>
              }
              bodyClassName="p-0"
            >
              <TraceCanvas
                trace={current.result.data}
                selected={selectedNode}
                onSelect={(node) =>
                  setSelection(node ? { address, node } : null)
                }
                height="h-[620px]"
              />
            </Panel>

            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Selected wallet">
                {selected ? (
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                        Address
                      </dt>
                      <dd className="mt-1.5">
                        <AddressChip address={selected.address} tone="strong" full />
                      </dd>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                          Tainted value
                        </dt>
                        <dd className="mt-1 font-mono text-ink">
                          {formatUsdt(selected.taintedValueUsdt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                          Share of reported
                        </dt>
                        <dd className="mt-1 font-mono text-ink">
                          {formatPercent(selected.taintFraction, 1)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                          First seen
                        </dt>
                        <dd className="mt-1 text-muted">
                          {formatDateTime(selected.firstSeen)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                          Outflows
                        </dt>
                        <dd className="mt-1 font-mono text-muted">
                          {selected.outflowCount}
                        </dd>
                      </div>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-faint">
                        Attribution
                      </dt>
                      <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                        {selected.label ? (
                          <>
                            <span className="text-ink">{selected.label.entity}</span>
                            <Chip tone="neutral">
                              {selected.label.kind.replace(/_/g, " ")}
                            </Chip>
                            <SourceChip source={selected.label.source} />
                            <span className="font-mono text-xs text-faint">
                              conf {selected.label.confidence.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-faint">
                            Unlabelled — no attribution in our data
                          </span>
                        )}
                      </dd>
                    </div>
                    {selected.label?.evidence ? (
                      <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 font-mono text-[11px] leading-5 text-muted">
                        {selected.label.evidence}
                      </p>
                    ) : null}
                  </dl>
                ) : (
                  <p className="text-sm text-faint">
                    Click any wallet in the graph to inspect it.
                  </p>
                )}
              </Panel>

              <Panel title="Triage call">
                <TriageBadge level={current.result.data.triage} size="lg" withAction />
                <p className="mt-4 text-sm leading-7 text-muted">
                  {current.result.data.triageReason}
                </p>
                {current.result.data.terminal?.depositAddress ? (
                  <div className="mt-4 rounded-lg border border-warm/30 bg-warm/[0.06] p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-warm">
                      {current.result.data.terminal.label.entity} deposit address
                    </p>
                    <code className="mt-1.5 block break-all font-mono text-xs text-ink">
                      {current.result.data.terminal.depositAddress}
                    </code>
                  </div>
                ) : null}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
