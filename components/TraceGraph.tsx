"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { NodeKind, TraceResult } from "@/lib/types";
import { formatDwell, formatUsdtCompact, shortAddress } from "@/lib/format";

/* ------------------------------------------------------------- node styling */

type Palette = {
  ring: string;
  bg: string;
  accent: string;
  chip: string;
  caption: string;
};

const KIND_STYLE: Record<NodeKind | "none", Palette> = {
  victim_reported: {
    ring: "#22d3ee",
    bg: "#0b1c22",
    accent: "#22d3ee",
    chip: "rgba(34,211,238,0.14)",
    caption: "Victim-reported",
  },
  exchange_deposit: {
    ring: "#f5b544",
    bg: "#1d1708",
    accent: "#f5b544",
    chip: "rgba(245,181,68,0.16)",
    caption: "Exchange deposit address",
  },
  exchange_hot: {
    ring: "#a78bfa",
    bg: "#161231",
    accent: "#a78bfa",
    chip: "rgba(167,139,250,0.16)",
    caption: "Exchange hot wallet",
  },
  mixer: {
    ring: "#ff6b6b",
    bg: "#22110f",
    accent: "#ff6b6b",
    chip: "rgba(255,107,107,0.16)",
    caption: "Mixing service",
  },
  sanctioned: {
    ring: "#ff6b6b",
    bg: "#22110f",
    accent: "#ff6b6b",
    chip: "rgba(255,107,107,0.16)",
    caption: "Sanctioned entity",
  },
  intermediary: {
    ring: "#3a4763",
    bg: "#111726",
    accent: "#8fa3bf",
    chip: "rgba(143,163,191,0.12)",
    caption: "Intermediary",
  },
  unknown: {
    ring: "#26314a",
    bg: "#111726",
    accent: "#8fa3bf",
    chip: "rgba(143,163,191,0.12)",
    caption: "Unlabelled wallet",
  },
  none: {
    ring: "#26314a",
    bg: "#111726",
    accent: "#8fa3bf",
    chip: "rgba(143,163,191,0.12)",
    caption: "Unlabelled wallet",
  },
};

function paletteFor(kind: NodeKind | null | undefined): Palette {
  const p = KIND_STYLE[(kind ?? "none") as NodeKind | "none"] ?? KIND_STYLE.none;
  // Guard against a typo'd hex ever reaching the DOM.
  return { ...p, ring: /^#[0-9a-f]{6}$/i.test(p.ring) ? p.ring : "#26314a" };
}

/* ---------------------------------------------------------------- the node */

type TxNodeData = {
  address: string;
  entity: string;
  caption: string;
  kind: NodeKind | null;
  taintedValueUsdt: number;
  taintFraction: number;
  confidence: number | null;
  depth: number;
  isTerminal: boolean;
  outflowCount: number;
};

type TxNode = Node<TxNodeData, "tx">;

function TxNodeView({ data, selected }: NodeProps<TxNode>) {
  const p = paletteFor(data.kind);
  return (
    <div
      className="w-[236px] rounded-xl border px-3.5 py-3 text-left shadow-lg transition"
      style={{
        borderColor: selected ? p.accent : `${p.ring}66`,
        background: p.bg,
        boxShadow: selected
          ? `0 0 0 2px ${p.accent}55, 0 12px 32px rgba(0,0,0,0.45)`
          : "0 10px 24px rgba(0,0,0,0.35)",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: p.chip, color: p.accent }}
        >
          {data.caption}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-[#5c6880]">
          hop {data.depth}
        </span>
      </div>

      <p className="mt-2 truncate text-[13px] font-semibold text-[#e8eef8]" title={data.entity}>
        {data.entity}
      </p>
      <p className="font-mono text-[11px] text-[#8a97ad]" title={data.address}>
        {shortAddress(data.address, 8, 6)}
      </p>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold" style={{ color: p.accent }}>
          {formatUsdtCompact(data.taintedValueUsdt)}
          <span className="ml-1 text-[9px] font-normal text-[#5c6880]">USDT tainted</span>
        </span>
        {data.confidence !== null ? (
          <span className="font-mono text-[10px] text-[#8a97ad]">
            conf {data.confidence.toFixed(2)}
          </span>
        ) : null}
      </div>

      {/* Share of the victim's money that reached this address. */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, data.taintFraction * 100))}%`,
            background: p.accent,
          }}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { tx: TxNodeView };

/* ------------------------------------------------------------------ layout */

const COL_WIDTH = 330;
const ROW_HEIGHT = 158;

function buildGraph(trace: TraceResult, selected: string | null): {
  nodes: TxNode[];
  edges: Edge[];
} {
  const byDepth = new Map<number, typeof trace.nodes>();
  for (const n of trace.nodes) {
    const list = byDepth.get(n.depth) ?? [];
    list.push(n);
    byDepth.set(n.depth, list);
  }

  const terminalAddress = trace.terminal?.address ?? null;
  const tallest = Math.max(1, ...[...byDepth.values()].map((l) => l.length));

  const nodes: TxNode[] = [];
  for (const [depth, list] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    // Centre each column against the tallest one so the flow reads left to right
    // along a stable spine.
    const offset = ((tallest - list.length) * ROW_HEIGHT) / 2;
    list.forEach((n, i) => {
      const kind = n.label?.kind ?? null;
      nodes.push({
        id: n.address,
        type: "tx",
        position: { x: depth * COL_WIDTH, y: offset + i * ROW_HEIGHT },
        selected: selected === n.address,
        data: {
          address: n.address,
          entity: n.label?.entity ?? "Unlabelled wallet",
          caption: paletteFor(kind).caption,
          kind,
          taintedValueUsdt: n.taintedValueUsdt,
          taintFraction: n.taintFraction,
          confidence: n.label ? n.label.confidence : null,
          depth: n.depth,
          isTerminal: n.address === terminalAddress,
          outflowCount: n.outflowCount,
        },
      });
    });
  }

  const edges: Edge[] = trace.edges.map((e, i) => {
    // Anything forwarded in under ten minutes is automated movement — the graph
    // says so before the officer reads a single risk flag.
    const fast = e.dwellSeconds !== null && e.dwellSeconds < 600;
    const stroke = fast ? "#f5b544" : "#3a4763";
    return {
      id: `${e.txHash || "edge"}-${i}`,
      source: e.from,
      target: e.to,
      type: "smoothstep",
      animated: fast,
      label: `${formatUsdtCompact(e.valueUsdt)} · ${formatDwell(e.dwellSeconds)}`,
      labelShowBg: true,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
      labelBgStyle: { fill: "#0d111c", stroke: "#1d2536" },
      labelStyle: { fill: "#8a97ad", fontSize: 10, fontFamily: "var(--font-geist-mono)" },
      style: { stroke, strokeWidth: fast ? 2 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
    };
  });

  return { nodes, edges };
}

/* --------------------------------------------------------------- component */

export default function TraceGraph({
  trace,
  selected = null,
  onSelect,
  className = "h-[560px]",
}: {
  trace: TraceResult;
  selected?: string | null;
  onSelect?: (address: string | null) => void;
  className?: string;
}) {
  const initial = useMemo(() => buildGraph(trace, selected), [trace, selected]);
  const [nodes, setNodes, onNodesChange] = useNodesState<TxNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  // Keep the canvas in step when the caller loads a different trace or selects a
  // row in the table beside it.
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: unknown, node: TxNode) => onSelect?.(node.id),
    [onSelect],
  );

  return (
    <div className={`w-full ${className}`}>
      <ReactFlow<TxNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelect?.(null)}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: false }}
        aria-label="Fund flow graph"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1b2334" />
        <Controls
          showInteractive={false}
          className="!border !border-line !bg-surface !shadow-none"
        />
      </ReactFlow>
    </div>
  );
}

/* ------------------------------------------------------------------ legend */

export function GraphLegend() {
  const items: Array<{ kind: NodeKind; text: string }> = [
    { kind: "victim_reported", text: "Victim-reported" },
    { kind: "unknown", text: "Unlabelled hop" },
    { kind: "exchange_deposit", text: "Exchange deposit address" },
    { kind: "exchange_hot", text: "Exchange hot wallet" },
    { kind: "mixer", text: "Mixer / sanctioned" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-faint">
      {items.map((i) => (
        <span key={i.kind} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: paletteFor(i.kind).accent }}
          />
          {i.text}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-6" style={{ background: "#f5b544" }} />
        Forwarded in under 10 minutes
      </span>
    </div>
  );
}
