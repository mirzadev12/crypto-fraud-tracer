"use client";

import { useState } from "react";
import type { TraceResult } from "@/lib/types";
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
  height = "h-[620px]",
}: {
  trace: TraceResult;
  selected: string | null;
  onSelect: (address: string | null) => void;
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
