"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  MarkerType,
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
  // Where the USDT trail ended because a contract pooled, swapped or bridged
  // it. A stop, not a finding, so it takes the neutral exchange-wallet greys.
  contract: {
    ring: "#3a3936",
    bg: "#141414",
    accent: "#a8a296",
    chip: "rgba(168,162,150,0.10)",
    caption: "Smart contract",
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
  /** This wallet is an investigative lead, and this is its number. */
  leadRank: number | null;
};

type TxNode = Node<TxNodeData, "tx">;

function TxNodeView({ data, selected }: NodeProps<TxNode>) {
  const p = paletteFor(data.kind);
  // A plate, not a card: charcoal, hairline, and a coloured edge on the left
  // that states what the wallet is. Colour never fills the shape.
  const opacity = data.background ? 0.25 : data.dimmed ? 0.4 : 1;
  // The exit is the answer, so it is the loudest plate on the canvas: a brass
  // frame and a wider body. Everything else on the graph is the route to it.
  const terminal = data.isTerminal;
  return (
    <div
      className={`relative ${terminal ? "w-[268px]" : "w-[248px]"} border border-line bg-surface px-4 py-4 text-left transition`}
      style={{
        borderLeft: `2px solid ${p.accent}`,
        borderColor: terminal ? "var(--color-brass-dim)" : undefined,
        borderLeftColor: p.accent,
        outline: selected ? "1px solid var(--color-brass)" : undefined,
        outlineOffset: selected ? "2px" : undefined,
        background: selected ? "#1e1e1e" : undefined,
        opacity,
      }}
    >
      {/* The lead number, hung off the top-left corner so it reads as an index
          into the leads panel rather than as part of the wallet's own data. */}
      {data.leadRank !== null ? (
        <span
          className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center border bg-bg font-mono text-[11px] font-semibold"
          style={{ borderColor: p.accent, color: p.accent }}
          aria-hidden="true"
        >
          {data.leadRank}
        </span>
      ) : null}
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: p.accent }}
        >
          {data.caption}
        </span>
        {terminal ? (
          <span className="shrink-0 border border-brass-dim px-2 py-[2px] font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-brass">
            Exit
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-[#9a948a]">
            HOP {data.depth}
          </span>
        )}
      </div>

      <p className="mt-4 truncate text-xs text-[#f0ead8]" title={data.entity}>
        {data.entity}
      </p>
      {data.background ? null : (
        <p className="mt-1 font-mono text-xs text-[#9a948a]" title={data.address}>
          {shortAddress(data.address, 8, 6)}
        </p>
      )}

      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-line pt-2">
        <span
          className={`font-mono ${terminal ? "text-base" : "text-sm"} text-[#f0ead8]`}
        >
          {formatUsdtCompact(data.taintedValueUsdt)}
          <span className="ml-2 font-mono text-[10px] tracking-[0.14em] text-[#9a948a]">
            TAINTED
          </span>
        </span>
        {data.confidence !== null ? (
          <span className="font-mono text-[10px] tracking-[0.14em] text-[#9a948a]">
            {(data.confidence * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>

      {/* The share of the victim's money that reached this wallet, as a bar.
          Taint is the one number that makes this evidence rather than a
          picture, and a figure alone does not let you compare two wallets at a
          glance across a canvas. */}
      {data.background ? null : (
        <div className="mt-2 flex items-center gap-2">
          <span
            className="h-[3px] flex-1 bg-[#2a2a28]"
            role="presentation"
          >
            <span
              className="block h-full"
              style={{
                width: `${Math.max(2, Math.min(100, data.taintFraction * 100))}%`,
                background: terminal ? "var(--color-brass)" : p.accent,
              }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-[#9a948a]">
            {(data.taintFraction * 100).toFixed(data.taintFraction < 0.1 ? 1 : 0)}%
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { tx: TxNodeView };

/* ------------------------------------------------------------------- edges */

type FlowEdge = Edge<{ lines: string[] }, "flow">;

/**
 * A smooth-step edge whose label is drawn in the HTML label layer rather than
 * inside the edge's own SVG. SVG paints in document order, so with the stock
 * edge a later transfer's line crossed an earlier transfer's label — where two
 * transfers converge on one wallet they share the last segment, and the amount
 * of one read as struck through by the other. The label layer sits above every
 * edge and below the cards, so no line can cross a figure.
 */
function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<FlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {data?.lines.length ? (
        <EdgeLabelRenderer>
          <div
            className="absolute whitespace-nowrap border px-2 py-1 text-center text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#0a0a0a",
              borderColor: "#2a2a28",
              color: "#9a948a",
              fontFamily: "var(--font-plex-mono)",
            }}
          >
            {data.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const edgeTypes = { flow: FlowEdgeView };

/* ------------------------------------------------------------------ layout */

// Wide enough that an edge label ("2.0K · 376 d 20 h", about 130 px) sits in the
// gap between two columns instead of over the cards on either side of it.
const COL_WIDTH = 420;
// A card is up to 176 px tall (the exit card carries more), so rows 158 apart
// overlapped; 200 leaves a 24 px gap on the house scale.
const ROW_HEIGHT = 200;

function buildGraph(
  trace: TraceResult,
  selected: string | null,
  leads: Map<string, number>,
): {
  nodes: TxNode[];
  edges: FlowEdge[];
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
          leadRank: leads.get(n.address) ?? null,
        },
      });
    });
  }

  // Several transfers between the same two wallets are one line. Drawn one per
  // transfer they lay exactly on top of each other: only the last label showed,
  // and a transfer forwarded in four minutes could sit under a grey line drawn
  // after it — hiding the one signal the colour exists to show. The same rule
  // as the batch canvas: the values sum, and the line is fast if any is.
  const pairs = new Map<
    string,
    { id: string; from: string; to: string; total: number; count: number; fastest: number | null }
  >();
  trace.edges.forEach((e, i) => {
    const key = `${e.from}>${e.to}`;
    const pair = pairs.get(key);
    if (pair) {
      pair.total += e.valueUsdt;
      pair.count += 1;
      if (e.dwellSeconds !== null && (pair.fastest === null || e.dwellSeconds < pair.fastest)) {
        pair.fastest = e.dwellSeconds;
      }
      return;
    }
    pairs.set(key, {
      id: `${e.txHash || "edge"}-${i}`,
      from: e.from,
      to: e.to,
      total: e.valueUsdt,
      count: 1,
      fastest: e.dwellSeconds,
    });
  });

  const edges: FlowEdge[] = [...pairs.values()].map((pair) => {
    // Anything forwarded in under ten minutes is automated movement — the graph
    // says so before the officer reads a single risk flag.
    const fast = pair.fastest !== null && pair.fastest < 600;
    const stroke = fast ? "#c98a34" : "#3a3936";
    const lines =
      pair.count === 1
        ? [`${formatUsdtCompact(pair.total)} · ${formatDwell(pair.fastest)}`]
        : [
            `${formatUsdtCompact(pair.total)} · ${pair.count} transfers`,
            ...(pair.fastest === null ? [] : [`fastest ${formatDwell(pair.fastest)}`]),
          ];
    return {
      id: pair.id,
      source: pair.from,
      target: pair.to,
      type: "flow",
      animated: fast,
      data: { lines },
      style: { stroke, strokeWidth: fast ? 2 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
    };
  });

  return { nodes, edges };
}

/* --------------------------------------------------------------- component */

const NO_LEADS: Map<string, number> = new Map();

export default function TraceGraph({
  trace,
  selected = null,
  onSelect,
  leads = NO_LEADS,
  className = "h-[560px]",
}: {
  trace: TraceResult;
  selected?: string | null;
  onSelect?: (address: string | null) => void;
  leads?: Map<string, number>;
  className?: string;
}) {
  const initial = useMemo(
    () => buildGraph(trace, selected, leads),
    [trace, selected, leads],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<TxNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initial.edges);

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
      <ReactFlow<TxNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelect?.(null)}
        fitView
        // Allowed to scale *up*, not just down. Capped at 1 the graph sat
        // marooned in the middle of a tall canvas at its natural size, which
        // made the wallets small enough that nobody discovered they are
        // clickable. A short trace should fill the space it is given.
        // The floor is low enough for the largest case (twelve wallets in one
        // hop) to fit whole on first view; below 0.3 it used to open cropped.
        fitViewOptions={{ padding: 0.14, maxZoom: 1.5, minZoom: 0.18 }}
        minZoom={0.18}
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
