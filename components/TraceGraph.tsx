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
import { entityPhrase } from "./ui";

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
    ring: "#c6a15b",
    bg: "#141414",
    accent: "#c6a15b",
    chip: "rgba(198,161,91,0.12)",
    caption: "Victim-reported",
  },
  exchange_deposit: {
    ring: "#c98a34",
    bg: "#1a150c",
    accent: "#c98a34",
    chip: "rgba(201,138,52,0.12)",
    caption: "Exchange deposit address",
  },
  exchange_hot: {
    ring: "#3a3936",
    bg: "#141414",
    accent: "#a8a296",
    chip: "rgba(168,162,150,0.10)",
    caption: "Exchange hot wallet",
  },
  mixer: {
    ring: "#cf5f55",
    bg: "#191111",
    accent: "#cf5f55",
    chip: "rgba(207,95,85,0.12)",
    caption: "Mixing service",
  },
  sanctioned: {
    ring: "#cf5f55",
    bg: "#191111",
    accent: "#cf5f55",
    chip: "rgba(207,95,85,0.12)",
    caption: "Sanctioned entity",
  },
  intermediary: {
    ring: "#2a2a28",
    bg: "#141414",
    accent: "#6b6660",
    chip: "rgba(107,102,96,0.10)",
    caption: "Intermediary",
  },
  unknown: {
    ring: "#2a2a28",
    bg: "#141414",
    accent: "#6b6660",
    chip: "rgba(107,102,96,0.10)",
    caption: "Unlabelled wallet",
  },
  none: {
    ring: "#2a2a28",
    bg: "#141414",
    accent: "#6b6660",
    chip: "rgba(107,102,96,0.10)",
    caption: "Unlabelled wallet",
  },
};

function paletteFor(kind: NodeKind | null | undefined): Palette {
  const p = KIND_STYLE[(kind ?? "none") as NodeKind | "none"] ?? KIND_STYLE.none;
  // Guard against a typo'd hex ever reaching the DOM.
  return { ...p, ring: /^#[0-9a-f]{6}$/i.test(p.ring) ? p.ring : "#2a2a28" };
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
  // A plate, not a card: charcoal, hairline, and a coloured edge on the left
  // that states what the wallet is. Colour never fills the shape.
  const opacity = data.background ? 0.25 : data.dimmed ? 0.4 : 1;
  return (
    <div
      className="w-[248px] border border-line bg-surface px-4 py-4 text-left transition"
      style={{
        borderLeft: `2px solid ${p.accent}`,
        outline: selected ? "1px solid var(--color-brass)" : undefined,
        outlineOffset: selected ? "2px" : undefined,
        background: selected ? "#1e1e1e" : undefined,
        opacity,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: p.accent }}
        >
          {data.caption}
        </span>
        <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-[#8c867d]">
          HOP {data.depth}
        </span>
      </div>

      <p className="mt-4 truncate text-xs text-[#f0ead8]" title={data.entity}>
        {data.entity}
      </p>
      {data.background ? null : (
        <p className="mt-1 font-mono text-xs text-[#8c867d]" title={data.address}>
          {shortAddress(data.address, 8, 6)}
        </p>
      )}

      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-line pt-2">
        <span className="font-mono text-sm text-[#f0ead8]">
          {formatUsdtCompact(data.taintedValueUsdt)}
          <span className="ml-2 font-mono text-[10px] tracking-[0.14em] text-[#8c867d]">
            TAINTED
          </span>
        </span>
        {data.confidence !== null ? (
          <span className="font-mono text-[10px] tracking-[0.14em] text-[#8c867d]">
            {(data.confidence * 100).toFixed(0)}%
          </span>
        ) : null}
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
          entity: entityPhrase(n.label),
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
    const stroke = fast ? "#c98a34" : "#3a3936";
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
      labelBgStyle: { fill: "#0a0a0a", stroke: "#262523" },
      labelStyle: { fill: "#8c867d", fontSize: 12, fontFamily: "var(--font-plex-mono)" },
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
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2a28" />
        <Controls
          showInteractive={false}
          className="!border !border-line !bg-surface !shadow-none"
        />
      </ReactFlow>
    </div>
  );
}
