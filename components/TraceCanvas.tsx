"use client";

import { useState } from "react";
import type { TraceResult } from "@/lib/types";
import type { DataSource } from "@/lib/api";
import BubbleMap, { BubbleLegend } from "./BubbleMap";
import TraceGraph, { GraphLegend } from "./TraceGraph";

export type CanvasView = "flow" | "bubbles";

/**
 * The two ways of reading one trace, behind a single toggle.
 *
 * Flow answers "where did it go and in what order". Bubbles answers "where did
 * the money end up". Both are driven by the same selection, so clicking a wallet
 * in one keeps it selected in the other and in the tables beside them.
 */
export default function TraceCanvas({
  trace,
  selected,
  onSelect,
  source,
  height = "h-[620px]",
}: {
  trace: TraceResult;
  selected: string | null;
  onSelect: (address: string | null) => void;
  source?: DataSource;
  height?: string;
}) {
  const [view, setView] = useState<CanvasView>("flow");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
        {view === "flow" ? <GraphLegend /> : <BubbleLegend />}
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "flow" ? (
        <TraceGraph
          trace={trace}
          selected={selected}
          onSelect={onSelect}
          className={height}
        />
      ) : (
        <BubbleMap
          trace={trace}
          selected={selected}
          onSelect={onSelect}
          className={height}
        />
      )}

      <Readout trace={trace} source={source} />
    </div>
  );
}

/**
 * Telemetry gutter. Every figure is read straight off the TraceResult — nothing
 * here is decorative or invented.
 */
function Readout({ trace, source }: { trace: TraceResult; source?: DataSource }) {
  const depth = trace.nodes.reduce((max, n) => Math.max(max, n.depth), 0);
  // Taint that actually landed: the terminal's share when there is one,
  // otherwise the largest share held anywhere past the victim.
  const terminalNode = trace.terminal
    ? trace.nodes.find((n) => n.address === trace.terminal?.address)
    : undefined;
  const taint =
    terminalNode?.taintFraction ??
    Math.max(0, ...trace.nodes.filter((n) => n.depth > 0).map((n) => n.taintFraction));

  const cells = [
    ["NODES", String(trace.nodes.length)],
    ["EDGES", String(trace.edges.length)],
    ["DEPTH", String(depth)],
    ["TAINT", `${(taint * 100).toFixed(1)}%`],
    ["SRC", source === "demo" ? "FIXTURE" : source === "live" ? "TRONGRID" : "—"],
    ["UTC", trace.provenance.generatedAt.replace(/\.\d+Z$/, "Z")],
  ];

  return (
    <div className="tx-scroll flex h-9 items-center gap-4 overflow-x-auto border-t border-line px-5 font-mono text-xs whitespace-nowrap text-faint">
      {cells.map(([k, v], i) => (
        <span key={k} className="flex items-center gap-4">
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          <span>
            {k} <span className="text-muted">{v}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: CanvasView;
  onChange: (view: CanvasView) => void;
}) {
  const options: Array<{ id: CanvasView; label: string; title: string }> = [
    { id: "flow", label: "Flow", title: "Hop-by-hop graph, left to right" },
    { id: "bubbles", label: "Bubbles", title: "Wallets sized by the victim funds that reached them" },
  ];
  return (
    <div
      className="flex shrink-0 rounded-lg border border-line bg-surface-2 p-1"
      role="group"
      aria-label="Graph view"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={view === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            view === o.id
              ? "bg-white/10 text-ink"
              : "text-faint hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
