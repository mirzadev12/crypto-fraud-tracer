"use client";

import { useMemo, useState } from "react";
import type { NodeKind, TraceResult } from "@/lib/types";
import { formatPercent, formatUsdt, formatUsdtCompact, shortAddress } from "@/lib/format";

/**
 * Bubble map — the same trace, read by weight instead of by sequence.
 *
 * The layered graph answers "where did it go, in what order". This answers
 * "where did the money end up" at a glance: the victim sits at the centre, every
 * other wallet radiates outward by hop, and each circle is sized by the share of
 * the victim's funds that reached it. A large circle far from the centre is the
 * cash-out; a large circle with nothing leaving it is money still sitting there.
 *
 * The layout is deterministic — one ring per hop, wallets spaced evenly around
 * it in depth-first order so a branch stays together, and every other ring
 * rotated half a slot so a two-way split never lines up with the next. No force
 * simulation, so the same trace always draws the same picture: that matters when
 * the image goes into an evidence packet.
 */

const KIND_COLOR: Record<NodeKind | "none", string> = {
  victim_reported: "#22d3ee",
  exchange_deposit: "#f5b544",
  exchange_hot: "#a78bfa",
  mixer: "#ff6b6b",
  sanctioned: "#ff6b6b",
  intermediary: "#8fa3bf",
  unknown: "#8fa3bf",
  none: "#8fa3bf",
};

const colorFor = (kind: NodeKind | null | undefined) =>
  KIND_COLOR[(kind ?? "none") as NodeKind | "none"] ?? KIND_COLOR.none;

const VIEW_W = 1000;
const VIEW_H = 620;

type Bubble = {
  address: string;
  entity: string;
  kind: NodeKind | null;
  depth: number;
  taintedValueUsdt: number;
  taintFraction: number;
  outflowCount: number;
  x: number;
  y: number;
  r: number;
  labelAbove: boolean;
};

type Link = {
  id: string;
  from: Bubble;
  to: Bubble;
  valueUsdt: number;
  fast: boolean;
  width: number;
};

function layout(trace: TraceResult): { bubbles: Bubble[]; links: Link[] } {
  const nodes = trace.nodes;
  if (nodes.length === 0) return { bubbles: [], links: [] };

  // First parent wins, so a wallet that several paths reconverge on is placed
  // once. The other edges into it are still drawn.
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const byAddress = new Map(nodes.map((n) => [n.address, n]));

  for (const e of trace.edges) {
    const from = byAddress.get(e.from);
    const to = byAddress.get(e.to);
    if (!from || !to) continue;
    if (to.depth <= from.depth) continue; // ignore back edges
    if (parentOf.has(to.address)) continue;
    parentOf.set(to.address, from.address);
    childrenOf.set(from.address, [...(childrenOf.get(from.address) ?? []), to.address]);
  }

  // Depth-first order, so wallets on the same branch stay neighbours on their
  // ring instead of being scattered around it.
  const order: string[] = [];
  const walk = (address: string, seen: Set<string>) => {
    if (seen.has(address)) return;
    seen.add(address);
    order.push(address);
    for (const kid of childrenOf.get(address) ?? []) walk(kid, seen);
  };
  const seen = new Set<string>();
  for (const root of nodes.filter((n) => !parentOf.has(n.address))) {
    walk(root.address, seen);
  }
  for (const n of nodes) walk(n.address, seen); // anything the edges missed

  const rank = new Map(order.map((address, i) => [address, i]));
  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n.address]);
  }
  for (const [depth, list] of byDepth) {
    byDepth.set(
      depth,
      [...list].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
    );
  }

  const maxDepth = Math.max(1, ...nodes.map((n) => n.depth));
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  // Elliptical rings: the panel is far wider than it is tall, so stretching the
  // rings horizontally buys separation that circular ones would waste.
  const rxStep = (VIEW_W / 2 - 90) / maxDepth;
  const ryStep = (VIEW_H / 2 - 64) / maxDepth;

  const maxTaint = Math.max(...nodes.map((n) => n.taintedValueUsdt), 1);
  // Capped against the tight axis so neighbouring rings never touch.
  const maxR = Math.min(54, ryStep * 0.4);
  const radiusOf = (value: number) =>
    Math.max(12, Math.sqrt(Math.max(value, 0) / maxTaint) * maxR);

  const bubbles: Bubble[] = [];
  for (const [depth, list] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((address, i) => {
      const n = byAddress.get(address);
      if (!n) return;
      // Even spacing around the ring, with each ring rotated by a fraction that
      // never repeats across the depths we draw. A fixed half-slot offset put
      // single-child rings back on one axis; this does not.
      const slot = ((i + 0.5) / list.length + depth * 0.31) % 1;
      const angle = slot * Math.PI * 2 - Math.PI / 2;
      bubbles.push({
        address: n.address,
        entity: n.label?.entity ?? "Unlabelled wallet",
        kind: n.label?.kind ?? null,
        depth: n.depth,
        taintedValueUsdt: n.taintedValueUsdt,
        taintFraction: n.taintFraction,
        outflowCount: n.outflowCount,
        x: cx + depth * rxStep * Math.cos(angle),
        y: cy + depth * ryStep * Math.sin(angle),
        r: radiusOf(n.taintedValueUsdt),
        // Labels go on the outward side, so they never land on the next ring.
        labelAbove: depth > 0 ? Math.sin(angle) < 0 : true,
      });
    });
  }

  const index = new Map(bubbles.map((b) => [b.address, b]));
  const maxValue = Math.max(...trace.edges.map((e) => e.valueUsdt), 1);
  const links: Link[] = [];
  trace.edges.forEach((e, i) => {
    const from = index.get(e.from);
    const to = index.get(e.to);
    if (!from || !to) return;
    links.push({
      id: `${e.txHash || "edge"}-${i}`,
      from,
      to,
      valueUsdt: e.valueUsdt,
      fast: e.dwellSeconds !== null && e.dwellSeconds < 600,
      width: 1 + (e.valueUsdt / maxValue) * 5,
    });
  });

  return { bubbles, links };
}

/** A gentle arc, so two flows between the same ring do not overlap. */
function arcPath(link: Link): string {
  const { from, to } = link;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(48, len * 0.14);
  // Perpendicular offset for the control point.
  const qx = mx + (-dy / len) * bow;
  const qy = my + (dx / len) * bow;
  return `M ${from.x} ${from.y} Q ${qx} ${qy} ${to.x} ${to.y}`;
}

export default function BubbleMap({
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
  const { bubbles, links } = useMemo(() => layout(trace), [trace]);
  const hopRings = useMemo(() => {
    const maxDepth = Math.max(1, ...bubbles.map((b) => b.depth));
    return Array.from({ length: maxDepth }, (_, i) => ({
      rx: ((i + 1) * (VIEW_W / 2 - 90)) / maxDepth,
      ry: ((i + 1) * (VIEW_H / 2 - 64)) / maxDepth,
    }));
  }, [bubbles]);
  const [hovered, setHovered] = useState<string | null>(null);

  const active = hovered ?? selected;
  const activeBubble = active ? bubbles.find((b) => b.address === active) : null;
  const connected = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const l of links) {
      if (l.from.address === active) set.add(l.to.address);
      if (l.to.address === active) set.add(l.from.address);
    }
    return set;
  }, [active, links]);

  return (
    <div className={`relative w-full ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="Bubble map of wallets on the traced path, sized by the victim funds that reached each one"
      >
        <defs>
          {bubbles.map((b) => (
            <radialGradient key={b.address} id={`bub-${b.address}`} cx="35%" cy="30%">
              <stop offset="0%" stopColor={colorFor(b.kind)} stopOpacity="0.55" />
              <stop offset="100%" stopColor={colorFor(b.kind)} stopOpacity="0.12" />
            </radialGradient>
          ))}
        </defs>

        {/* Hop rings, so distance from the centre reads as hops from the victim. */}
        {hopRings.map((ring, i) => (
          <ellipse
            key={i}
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            rx={ring.rx}
            ry={ring.ry}
            fill="none"
            stroke="#1b2334"
            strokeDasharray="3 7"
          />
        ))}

        {links.map((l) => {
          const dim = connected
            ? !(connected.has(l.from.address) && connected.has(l.to.address))
            : false;
          return (
            <g key={l.id} opacity={dim ? 0.16 : 1}>
              <path
                d={arcPath(l)}
                fill="none"
                stroke={l.fast ? "#f5b544" : "#3a4763"}
                strokeWidth={l.width}
                strokeLinecap="round"
                opacity={l.fast ? 0.85 : 0.6}
              />
            </g>
          );
        })}

        {bubbles.map((b) => {
          const dim = connected ? !connected.has(b.address) : false;
          const isSelected = selected === b.address;
          const color = colorFor(b.kind);
          return (
            <g
              key={b.address}
              opacity={dim ? 0.28 : 1}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(b.address)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(b.address)}
              tabIndex={0}
              role="button"
              aria-label={`${b.entity}, ${shortAddress(b.address)}, ${formatUsdt(b.taintedValueUsdt)} tainted`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(b.address);
                }
              }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={`url(#bub-${b.address})`}
                stroke={color}
                strokeWidth={isSelected ? 2.5 : 1.4}
                strokeOpacity={isSelected ? 1 : 0.7}
              />
              {/* Money that arrived but never left is what an officer is hunting. */}
              {b.outflowCount === 0 && b.depth > 0 ? (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 5}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.35"
                  strokeDasharray="2 4"
                />
              ) : null}
              <text
                x={b.x}
                y={b.y + 4}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{
                  fill: "#e8eef8",
                  fontSize: b.r > 26 ? 12 : 10,
                  fontFamily: "var(--font-geist-mono)",
                  fontWeight: 600,
                  paintOrder: "stroke",
                  stroke: "#070a12",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
              >
                {formatUsdtCompact(b.taintedValueUsdt)}
              </text>
              <text
                x={b.x}
                y={b.labelAbove ? b.y - b.r - 11 : b.y + b.r + 17}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{
                  fill: "#8a97ad",
                  fontSize: 11,
                  // Halo, so a caption stays readable where it crosses an edge.
                  paintOrder: "stroke",
                  stroke: "#070a12",
                  strokeWidth: 3.5,
                  strokeLinejoin: "round",
                }}
              >
                {b.kind ? b.entity : shortAddress(b.address, 6, 4)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detail card for whatever is under the cursor. */}
      {activeBubble ? (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-xl border border-line bg-surface/95 p-4 shadow-xl backdrop-blur">
          <p className="text-sm font-semibold text-ink">{activeBubble.entity}</p>
          <p className="mt-0.5 font-mono text-[11px] text-faint">
            {shortAddress(activeBubble.address, 10, 8)}
          </p>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Tainted value</dt>
              <dd className="font-mono text-ink">
                {formatUsdt(activeBubble.taintedValueUsdt, { symbol: false })}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Share of reported</dt>
              <dd className="font-mono text-ink">
                {formatPercent(activeBubble.taintFraction, 1)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Hop</dt>
              <dd className="font-mono text-ink">{activeBubble.depth}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Outflows</dt>
              <dd className="font-mono text-ink">
                {activeBubble.outflowCount === 0
                  ? "none — funds at rest"
                  : activeBubble.outflowCount}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function BubbleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-faint">
      <span>Circle size = victim funds that reached the wallet</span>
      <span>Distance from centre = hops</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-6" style={{ background: "#f5b544" }} />
        Forwarded in under 10 minutes
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-dashed border-cold" />
        Dashed ring = nothing left this wallet
      </span>
    </div>
  );
}
