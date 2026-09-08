"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RiskFlag, TraceResult } from "@/lib/types";
import type { DataSource } from "@/lib/api";
import {
  elapsedBetween,
  formatDateTime,
  formatDwell,
  formatPercent,
  formatUsdt,
  shortAddress,
  tronscanTxUrl,
} from "@/lib/format";
import AddressChip from "./AddressChip";
import CopyButton from "./CopyButton";
import TraceCanvas, { ViewToggle, type CanvasView } from "./TraceCanvas";
import {
  Chip,
  Corners,
  DataSourceBadge,
  Gutter,
  Panel,
  SourceChip,
  StatCard,
  TRIAGE_META,
  TriageBadge,
  buttonStyles,
} from "./ui";

/* ------------------------------------------------------------- risk flags */

const RISK_META: Record<
  RiskFlag["code"],
  { title: string; tone: "hot" | "warm" | "cold" }
> = {
  SHORT_DWELL: { title: "Short dwell time", tone: "warm" },
  HIGH_FANOUT: { title: "High fan-out", tone: "warm" },
  PEEL_CHAIN: { title: "Peel chain", tone: "warm" },
  ROUND_AMOUNTS: { title: "Round amounts", tone: "cold" },
  NEW_ADDRESS: { title: "Newly created address", tone: "cold" },
  SANCTIONED_CONTACT: { title: "Sanctioned / mixer contact", tone: "hot" },
};

export function RiskFlagList({
  flags,
  onSelect,
}: {
  flags: RiskFlag[];
  onSelect?: (address: string) => void;
}) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-faint">
        No laundering patterns fired on this path.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {flags.map((f, i) => {
        const meta = RISK_META[f.code] ?? { title: f.code, tone: "cold" as const };
        return (
          <li
            key={`${f.code}-${f.atAddress}-${i}`}
            className="rounded-panel border border-line bg-surface-2/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={meta.tone}>{meta.title}</Chip>
              <code className="font-mono text-xs uppercase tracking-wider text-faint">
                {f.code}
              </code>
            </div>
            {/* Written by the backend, rendered verbatim — this is the sentence
                the officer reads off the screen. */}
            <p className="mt-2.5 text-sm leading-6 text-ink">{f.reason}</p>
            <button
              type="button"
              onClick={() => onSelect?.(f.atAddress)}
              className="mt-2 font-mono text-xs text-faint transition hover:text-brand"
              title={f.atAddress}
            >
              at {shortAddress(f.atAddress, 8, 6)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------- terminal card */

function TerminalCard({ trace }: { trace: TraceResult }) {
  const meta = TRIAGE_META[trace.triage];

  if (!trace.terminal) {
    // No off-ramp reached: the money is still sitting somewhere.
    const resting = [...trace.nodes]
      .filter((n) => n.outflowCount === 0)
      .sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt)[0];
    return (
      <div className={`relative rounded-panel border bg-surface p-6 ${meta.ring}`}>
        <Corners />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-faint">
            Where the money is now
          </p>
          <TriageBadge level={trace.triage} size="lg" />
        </div>
        <p className="mt-4 text-2xl font-semibold tracking-tight text-ink">
          No exchange reached — funds still at rest
        </p>
        {resting ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Resting at</span>
              <AddressChip address={resting.address} tone="strong" full />
            </div>
            <p className="font-mono text-lg text-hot">
              {formatUsdt(resting.taintedValueUsdt)}
              <span className="ml-2 text-xs text-faint">
                {formatPercent(resting.taintFraction)} of the reported amount
              </span>
            </p>
          </div>
        ) : null}
        <p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-muted">
          {trace.triageReason}
        </p>
      </div>
    );
  }

  const { label, depositAddress, address } = trace.terminal;
  const isDeposit = label.kind === "exchange_deposit" && Boolean(depositAddress);

  return (
    <div className={`relative rounded-panel border bg-surface p-6 ${meta.ring}`}>
      <Corners />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-faint">
          {isDeposit ? "Attributed destination" : "End of traceable path"}
        </p>
        <TriageBadge level={trace.triage} size="lg" />
      </div>

      {isDeposit ? null : (
        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <p className="text-3xl font-semibold tracking-tight text-ink">{label.entity}</p>
          <Chip tone="hot">{label.kind.replace(/_/g, " ")}</Chip>
        </div>
      )}

      {isDeposit ? (
        /* The whole product in one element. Nothing else in the app is set this
           large, and that is deliberate — it is the account an exchange can
           actually freeze. */
        <div className="mt-5 border-t border-line pt-5">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-warm">
            Customer deposit address
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <code className="break-all font-mono text-2xl leading-tight tracking-tight text-ink md:text-3xl">
              {depositAddress}
            </code>
            <CopyButton value={depositAddress!} label="Copy" className="mt-1.5" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            <span className="font-medium text-ink">{label.entity}</span>
            <span className="text-faint">·</span>
            <span className="font-mono tabular-nums">
              {formatPercent(label.confidence)} confidence
            </span>
            <SourceChip source={label.source} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            This is the account {label.entity} can freeze. Name it in the freeze
            request — not just the exchange.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Terminal address</span>
          <AddressChip address={address} tone="strong" full />
        </div>
      )}

      <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
        {isDeposit ? null : (
          <>
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
                Confidence
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-ink">
                {formatPercent(label.confidence)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
                Attribution source
              </dt>
              <dd className="mt-1.5">
                <SourceChip source={label.source} />
              </dd>
            </div>
          </>
        )}
        <div className="sm:col-span-1">
          <dt className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
            Time to destination
          </dt>
          <dd className="mt-1 font-mono text-lg text-ink">
            {trace.edges.length > 0
              ? elapsedBetween(
                  trace.fraudDate,
                  trace.edges[trace.edges.length - 1].timestamp,
                )
              : "—"}
          </dd>
        </div>
      </dl>

      {label.evidence ? (
        <p className="mt-4 rounded-lg border border-line bg-surface-2/60 px-4 py-3 font-mono text-xs leading-6 text-muted">
          {label.evidence}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-muted">{trace.triageReason}</p>
    </div>
  );
}

/* --------------------------------------------------------------- sub-views */

function NodesTable({
  trace,
  selected,
  onSelect,
}: {
  trace: TraceResult;
  selected: string | null;
  onSelect: (address: string) => void;
}) {
  const rows = useMemo(
    () => [...trace.nodes].sort((a, b) => a.depth - b.depth || b.taintedValueUsdt - a.taintedValueUsdt),
    [trace.nodes],
  );

  return (
    <div className="tx-scroll overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-faint">
            <th className="px-4 py-3 font-medium">Hop</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium">Attribution</th>
            <th className="px-4 py-3 text-right font-medium">Tainted value</th>
            <th className="px-4 py-3 text-right font-medium">Share</th>
            <th className="px-4 py-3 text-right font-medium">Outflows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const active = selected === n.address;
            return (
              <tr
                key={n.address}
                onClick={() => onSelect(n.address)}
                className={`cursor-pointer border-b border-line-soft transition last:border-0 ${
                  active ? "bg-brand/[0.07]" : "hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-faint">{n.depth}</td>
                <td className="px-4 py-3">
                  <AddressChip
                    address={n.address}
                    tone={active ? "brand" : "strong"}
                    explorer={false}
                  />
                  <p className="mt-0.5 text-xs text-faint">
                    First seen {formatDateTime(n.firstSeen)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {n.label ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-ink">{n.label.entity}</span>
                      <SourceChip source={n.label.source} />
                    </div>
                  ) : (
                    <span className="text-faint">Unlabelled</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {formatUsdt(n.taintedValueUsdt, { symbol: false })}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                  {formatPercent(n.taintFraction, 1)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                  {n.outflowCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MovementTimeline({
  trace,
  onSelect,
}: {
  trace: TraceResult;
  onSelect: (address: string) => void;
}) {
  const rows = useMemo(
    () =>
      [...trace.edges].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [trace.edges],
  );

  if (rows.length === 0) {
    return <p className="text-sm text-faint">No transfers were found on this path.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-line pl-6">
      {rows.map((e, i) => {
        const fast = e.dwellSeconds !== null && e.dwellSeconds < 600;
        return (
          <li key={`${e.txHash}-${i}`} className="relative">
            <span
              className={`absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg ${
                fast ? "bg-warm" : "bg-cold"
              }`}
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <button
                type="button"
                onClick={() => onSelect(e.from)}
                className="font-mono text-xs text-muted transition hover:text-brand"
              >
                {shortAddress(e.from)}
              </button>
              <span className="text-faint">→</span>
              <button
                type="button"
                onClick={() => onSelect(e.to)}
                className="font-mono text-xs text-muted transition hover:text-brand"
              >
                {shortAddress(e.to)}
              </button>
              <span className="font-mono text-sm font-semibold text-ink">
                {formatUsdt(e.valueUsdt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
              <span>{formatDateTime(e.timestamp)}</span>
              <span className={fast ? "text-warm" : ""}>
                held {formatDwell(e.dwellSeconds)}
              </span>
              {e.txHash ? (
                <a
                  href={tronscanTxUrl(e.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono transition hover:text-brand"
                  title={e.txHash}
                >
                  tx {e.txHash.slice(0, 10)}…
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ProvenancePanel({ trace }: { trace: TraceResult }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-faint">Chain</dt>
          <dd className="font-mono text-ink">TRON · USDT (TRC-20)</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-faint">API calls made</dt>
          <dd className="font-mono text-ink">{trace.provenance.apiCalls}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-faint">Responses hashed</dt>
          <dd className="font-mono text-ink">
            {trace.provenance.responseHashes.length}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-faint">Generated</dt>
          <dd className="font-mono text-ink">
            {formatDateTime(trace.provenance.generatedAt)}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-faint">
          SHA-256 of each API response
        </p>
        <div className="tx-scroll mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface-2/60 p-3">
          {trace.provenance.responseHashes.length === 0 ? (
            <p className="text-xs text-faint">No response hashes were recorded.</p>
          ) : (
            trace.provenance.responseHashes.map((h) => (
              <p key={h} className="break-all font-mono text-xs leading-5 text-muted">
                {h}
              </p>
            ))
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-faint">
          Each hash fixes the exact API response this trace was built from, so the
          evidence packet can be re-verified later.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- view */

export default function TraceView({
  trace,
  source,
  note,
}: {
  trace: TraceResult;
  source: DataSource;
  note?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CanvasView>("flow");

  const reachedTerminal = trace.terminal
    ? trace.nodes.find((n) => n.address === trace.terminal!.address)
    : null;
  const hops = trace.nodes.reduce((max, n) => Math.max(max, n.depth), 0);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{trace.caseId}</span>
            <DataSourceBadge source={source} note={note} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Trace result
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Victim-reported address</span>
            <AddressChip address={trace.inputAddress} tone="strong" full />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/fund-flow?address=${encodeURIComponent(trace.inputAddress)}`}
            className={buttonStyles.secondary}
          >
            Open in Fund Flow
          </Link>
          <Link
            href={`/report/${encodeURIComponent(trace.inputAddress)}`}
            className={buttonStyles.primary}
          >
            Evidence packet
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------ money slide */}
      <Gutter index="01 / 04" label="Finding" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TerminalCard trace={trace} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Reported amount"
            value={formatUsdt(trace.reportedAmountUsdt, { symbol: false })}
            hint={`Fraud reported ${formatDateTime(trace.fraudDate)}`}
          />
          <StatCard
            label={trace.terminal ? "Reached destination" : "Traced value"}
            value={formatUsdt(
              reachedTerminal?.taintedValueUsdt ??
                Math.max(...trace.nodes.map((n) => (n.depth > 0 ? n.taintedValueUsdt : 0)), 0),
              { symbol: false },
            )}
            hint={
              reachedTerminal
                ? `${formatPercent(reachedTerminal.taintFraction)} of the victim's funds`
                : "Largest tainted balance on the path"
            }
            tone={trace.triage === "HOT" ? "hot" : trace.triage === "WARM" ? "warm" : "cold"}
          />
          <StatCard
            label="Path"
            value={`${hops} hops · ${trace.nodes.length} wallets`}
            hint={`${trace.edges.length} transfers · ${trace.riskFlags.length} risk flags`}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ graph */}
      <Gutter index="02 / 04" label="Fund flow" />
      <Panel
        title="Fund flow"
        subtitle="Click a wallet to highlight it in the tables below. Flow reads the path in order; Bubbles reads it by weight."
        actions={<ViewToggle view={view} onChange={setView} />}
        code={trace.caseId}
        bodyClassName="p-0"
      >
        <TraceCanvas
          trace={trace}
          selected={selected}
          onSelect={setSelected}
          source={source}
          view={view}
          height="h-[560px]"
        />
      </Panel>

      {/* ------------------------------------------------- tables & flags */}
      <Gutter index="03 / 04" label="Wallets and risk" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Wallets on the path"
          subtitle="Taint is the share of the victim's money that reached each address."
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <NodesTable trace={trace} selected={selected} onSelect={setSelected} />
        </Panel>

        <Panel
          title="Risk flags"
          subtitle="Rule-based, each one explainable to a judge."
        >
          <RiskFlagList flags={trace.riskFlags} onSelect={setSelected} />
        </Panel>
      </div>

      {/* -------------------------------------------------------- timeline */}
      <Gutter index="04 / 04" label="Timeline and custody" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Movement timeline" className="lg:col-span-2">
          <MovementTimeline trace={trace} onSelect={setSelected} />
        </Panel>

        <div className="space-y-5">
          {trace.narrative ? (
            <Panel title="Investigator summary" subtitle="Generated from the trace result.">
              <p className="text-sm leading-7 text-muted">{trace.narrative}</p>
            </Panel>
          ) : null}
          <Panel title="Chain of custody">
            <ProvenancePanel trace={trace} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
