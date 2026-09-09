"use client";

import { useState } from "react";
import type { TraceResult } from "@/lib/types";
import type { DataSource } from "@/lib/api";
import BubbleMap from "./BubbleMap";
import TraceGraph from "./TraceGraph";

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
  view: controlledView,
  height = "h-[620px]",
}: {
  trace: TraceResult;
  selected: string | null;
  onSelect: (address: string | null) => void;
  source?: DataSource;
  /**
   * Pass this to host the toggle in your own panel header — the canvas then has
   * no chrome of its own, which is one row of furniture fewer above the graph.
   * Leave it out and the canvas manages the view itself.
   */
  view?: CanvasView;
  height?: string;
}) {
  const [ownView, setOwnView] = useState<CanvasView>("flow");
  const view = controlledView ?? ownView;

  return (
    <div>
      {controlledView === undefined ? (
        <div className="flex justify-end border-b border-line-soft px-6 py-4">
          <ViewToggle view={view} onChange={setOwnView} />
        </div>
      ) : null}

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

      <Readout trace={trace} source={source} view={view} />
    </div>
  );
}

/**
 * Telemetry gutter: what is on the canvas, and the one encoding rule the canvas
 * cannot state about itself. Every figure is read straight off the TraceResult —
 * nothing here is decorative or invented.
 *
 * The legend used to be a separate row above the graph. It reads better here:
 * the node cards already name their own kind, so all that was left to say is how
 * to read the edges and, in bubble view, the size and distance encoding.
 */
function Readout({
  trace,
  source,
  view,
}: {
  trace: TraceResult;
  source?: DataSource;
  view: CanvasView;
}) {
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
    ["FEED", source === "demo" ? "DEMO" : source === "live" ? "LIVE" : "—"],
    ["UTC", trace.provenance.generatedAt.replace(/\.\d+Z$/, "Z")],
  ];

  return (
    <div className="fx-scroll flex h-9 items-center gap-4 overflow-x-auto border-t border-line px-6 font-mono text-xs whitespace-nowrap text-faint">
      <span className="flex items-center gap-2">
        <span className="h-px w-5 bg-suspicious" />
        {"<10 MIN"}
      </span>
      {view === "bubbles" ? (
        <>
          <span aria-hidden="true">·</span>
          <span>SIZE = TAINT</span>
          <span aria-hidden="true">·</span>
          <span>RING = HOP</span>
        </>
      ) : null}
      <span className="ml-auto flex items-center gap-4">
        {cells.map(([k, v], i) => (
          <span key={k} className="flex items-center gap-4">
            {i > 0 ? <span aria-hidden="true">·</span> : null}
            <span>
              {k} <span className="text-muted">{v}</span>
            </span>
          </span>
        ))}
      </span>
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
      className="flex shrink-0 border border-line bg-surface-2 p-1"
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
          className={`fx-option-quiet px-4 py-2 text-xs font-semibold ${
            view === o.id
              ? "fx-option-on bg-white/10 text-ink"
              : "text-faint hover:text-brass"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
