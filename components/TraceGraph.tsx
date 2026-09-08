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
    ring: "#7aa2d6",
    bg: "#0e1622",
    accent: "#7aa2d6",
    chip: "rgba(122,162,214,0.14)",
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
    ring: "#5f7fa8",
    bg: "#111826",
    accent: "#8fa3bf",
    chip: "rgba(143,163,191,0.14)",
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

/** #rrggbb -> rgba(), for the low-alpha fills below. */
function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(143,163,191,${a})`;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${a})`;
}

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
  /** Something else is selected — this node steps back. */
  dimmed: boolean;
  /** Barely any of the victim's money came here. */
  background: boolean;
};

type TxNode = Node<TxNodeData, "tx">;

function TxNodeView({ data, selected }: NodeProps<TxNode>) {
  const p = paletteFor(data.kind);
  // The ring carries the weight — no shadow, no glow. Fill is a low-alpha wash
  // of the same hue so the card reads as a tint of its category.
  const opacity = data.background ? 0.12 : data.dimmed ? 0.25 : 1;
  return (
    <div
      className="w-[236px] rounded-panel px-3.5 py-3 text-left transition"
      style={{
        border: `${selected ? 3 : 2}px solid ${p.accent}`,
        outline: selected ? "1px solid var(--color-ink)" : undefined,
        outlineOffset: selected ? "2px" : undefined,
        background: alpha(p.accent, 0.08),
        opacity,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: p.chip, color: p.accent }}
        >
          {data.caption}
        </span>
        <span className="shrink-0 font-mono text-xs text-[#8b97b0]">
          hop {data.depth}
        </span>
      </div>

      <p className="mt-2 truncate text-[13px] font-semibold text-[#e8eef8]" title={data.entity}>
        {data.entity}
      </p>
      {data.background ? null : (
        <p className="font-mono text-xs text-[#9aa6bb]" title={data.address}>
          {shortAddress(data.address, 8, 6)}
        </p>
      )}

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold" style={{ color: p.accent }}>
          {formatUsdtCompact(data.taintedValueUsdt)}
          <span className="ml-1 text-[10px] font-normal text-[#8b97b0]">USDT tainted</span>
        </span>
        {data.confidence !== null ? (
          <span className="font-mono text-xs text-[#9aa6bb]">
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
          dimmed: selected !== null && selected !== n.address,
          background: n.taintFraction < 0.01,
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
      labelStyle: { fill: "#9aa6bb", fontSize: 12, fontFamily: "var(--font-geist-mono)" },
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
