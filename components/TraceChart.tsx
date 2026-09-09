"use client";

import { useMemo, useState } from "react";
import type { TraceResult } from "@/lib/types";
import {
  formatDateTime,
  formatDwell,
  formatPercent,
  formatUsdt,
  formatUsdtCompact,
  shortAddress,
} from "@/lib/format";

/**
 * The third canvas view: the trace as data rather than as a diagram.
 *
 * Flow answers "what shape is this case", Bubbles answers "where did the weight
 * go". Neither answers the two questions an investigator asks next — *when* did
 * the money move, and *how much of it survived each hop* — and both of those are
 * already in the `TraceResult`, unplotted.
 *
 * So: a timeline of every transfer on the path, and the taint decay by hop.
 * Drawn in plain markup rather than a chart library, because `@xyflow/react` is
 * the only dependency this project allows (AGENTS.md §3), and because bars
 * positioned by percentage are responsive for free.
 *
 * It shares one selection with the other two views, so clicking a transfer here
 * highlights the same wallet on the graph and in the tables.
 */

/** Values span several orders of magnitude, so bar height is a square root. */
function heightPct(value: number, max: number): number {
  if (max <= 0) return 2;
  return Math.max(3, Math.sqrt(value / max) * 100);
}

/** Under ten minutes between receipt and forwarding — the automation signal. */
const FAST_SECONDS = 600;

export default function TraceChart({
  trace,
  selected = null,
  onSelect,
  className = "h-[620px]",
}: {
  trace: TraceResult;
  selected?: string | null;
  onSelect?: (address: string | null) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const model = useMemo(() => {
    const edges = [...trace.edges].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    const times = edges.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite);
    const first = times.length ? Math.min(...times) : 0;
    const last = times.length ? Math.max(...times) : 0;
    const span = Math.max(1, last - first);
    const maxValue = edges.reduce((m, e) => Math.max(m, e.valueUsdt), 0);

    // Taint by hop: how much of the victim's money was still identifiable at
    // each remove from the reported wallet.
    const depths = [...new Set(trace.nodes.map((n) => n.depth))].sort((a, b) => a - b);
    const hops = depths.map((depth) => {
      const at = trace.nodes.filter((n) => n.depth === depth);
      return {
        depth,
        wallets: at.length,
        value: at.reduce((s, n) => s + n.taintedValueUsdt, 0),
        share: at.reduce((s, n) => s + n.taintFraction, 0),
      };
    });
    const maxHop = hops.reduce((m, h) => Math.max(m, h.share), 0);

    return { edges, first, last, span, maxValue, hops, maxHop };
  }, [trace]);

  const active = hovered ?? selected;
  const activeEdge =
    model.edges.find((e) => e.txHash === hovered) ??
    model.edges.find((e) => e.to === active || e.from === active) ??
    null;

  return (
    <div className={`flex w-full min-w-0 flex-col ${className}`}>
      {/* ------------------------------------------------------------ readout */}
      <div className="flex min-h-[64px] shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-line px-6 py-4">
        {activeEdge ? (
          <>
            <span className="font-mono text-base text-ink">
              {formatUsdt(activeEdge.valueUsdt)}
            </span>
            <span className="font-mono text-xs text-faint">
              {shortAddress(activeEdge.from, 6, 4)} → {shortAddress(activeEdge.to, 6, 4)}
            </span>
            <span className="font-mono text-xs text-faint">
              {formatDateTime(activeEdge.timestamp)}
            </span>
            {activeEdge.dwellSeconds !== null ? (
              <span
                className={`font-mono text-xs ${
                  activeEdge.dwellSeconds < FAST_SECONDS ? "text-suspicious" : "text-faint"
                }`}
              >
                HELD {formatDwell(activeEdge.dwellSeconds)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs leading-6 text-faint">
            Point at a transfer to read it. Click to follow that wallet.
          </span>
        )}
      </div>

      {/* ----------------------------------------------------------- timeline */}
      <div className="min-h-0 flex-1 px-6 pb-2 pt-6">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
          Transfers · {model.edges.length}
        </p>

        <div className="relative mt-4 h-[46%] min-h-[132px] border-b border-line">
          {/* The scale, stated. A bar chart whose axis is never named is a
              decoration — these bars span orders of magnitude, so the largest
              is labelled and a half-height rule gives the eye something to
              measure the rest against. */}
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line/60" />
          <span className="pointer-events-none absolute left-0 top-0 -translate-y-[calc(100%+2px)] font-mono text-[10px] text-dim">
            {formatUsdtCompact(model.maxValue)}
          </span>
          <span
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/40"
            style={{ top: "50%" }}
          />
          {model.edges.map((e) => {
            const at = Date.parse(e.timestamp);
            const left = Number.isFinite(at) ? ((at - model.first) / model.span) * 100 : 0;
            const fast = e.dwellSeconds !== null && e.dwellSeconds < FAST_SECONDS;
            const isActive = active === e.to || active === e.from || hovered === e.txHash;
            return (
              <button
                key={e.txHash}
                type="button"
                onMouseEnter={() => setHovered(e.txHash)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(e.txHash)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(e.to === selected ? null : e.to)}
                title={`${formatUsdt(e.valueUsdt)} · ${formatDateTime(e.timestamp)}`}
                aria-label={`Transfer of ${formatUsdt(e.valueUsdt)} to ${shortAddress(e.to)} on ${formatDateTime(e.timestamp)}`}
                className="absolute bottom-0 w-[9px] -translate-x-1/2 transition-[opacity,background] hover:opacity-100"
                style={{
                  left: `${left}%`,
                  height: `${heightPct(e.valueUsdt, model.maxValue)}%`,
                  background: fast ? "var(--color-suspicious)" : "var(--color-brass-dim)",
                  opacity: isActive ? 1 : active ? 0.35 : 0.85,
                  outline: isActive ? "1px solid var(--color-brass)" : undefined,
                  outlineOffset: "1px",
                }}
              />
            );
          })}
        </div>

        {/* The window, stated. A bar chart with no dates on it is decoration. */}
        <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] text-dim">
          <span>{formatDateTime(new Date(model.first).toISOString())}</span>
          <span>{formatDateTime(new Date(model.last).toISOString())}</span>
        </div>

        {/* ------------------------------------------------------ taint decay */}
        <p className="mt-8 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
          Taint by hop
        </p>
        <ul className="mt-4 space-y-3">
          {model.hops.map((h) => (
            <li key={h.depth} className="flex items-center gap-4">
              <span className="w-14 shrink-0 font-mono text-[10px] tracking-[0.14em] text-faint">
                HOP {h.depth}
              </span>
              <span className="h-[6px] min-w-0 flex-1 bg-[#2a2a28]">
                <span
                  className="block h-full"
                  style={{
                    width: `${model.maxHop > 0 ? Math.max(1.5, (h.share / model.maxHop) * 100) : 0}%`,
                    background:
                      h.depth === 0 ? "var(--color-brass)" : "var(--color-brass-dim)",
                  }}
                />
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-xs text-ink">
                {formatUsdtCompact(h.value)}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-faint">
                {formatPercent(h.share, h.share < 0.1 ? 1 : 0)}
              </span>
              <span className="hidden w-24 shrink-0 text-right font-mono text-[10px] text-dim sm:block">
                {h.wallets} {h.wallets === 1 ? "wallet" : "wallets"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
