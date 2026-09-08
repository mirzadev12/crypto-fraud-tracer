"use client";

import { useMemo, useState } from "react";
import type { NodeKind, TraceResult } from "@/lib/types";
import { formatPercent, formatUsdt, formatUsdtCompact, shortAddress } from "@/lib/format";
import { entityPhrase } from "./ui";

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
  victim_reported: "#c6a15b", // brass — the subject of the file
  exchange_deposit: "#c98a34", // suspicious — the exit
  exchange_hot: "#a8a296",
  mixer: "#cf5f55", // critical
  sanctioned: "#cf5f55",
  intermediary: "#6b6660",
  unknown: "#6b6660",
  none: "#6b6660",
};

const colorFor = (kind: NodeKind | null | undefined) =>
  KIND_COLOR[(kind ?? "none") as NodeKind | "none"] ?? KIND_COLOR.none;

const VIEW_W = 1000;
const VIEW_H = 620;

type Bubble = {
  address: string;
  entity: string;
  confidence: number | null;
  source: string | null;
  evidence: string | null;
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

  /**
   * Size is the victim's money, banded by what the wallet is.
   *
   * A subject wallet, an exchange exit and an unlabelled hop are not the same
   * kind of object, so they do not compete on the same scale: each kind gets a
   * band, and taint places the circle inside its band. Anything holding under
   * five percent of the reported amount drops to a background mark.
   */
  const radiusOf = (kind: NodeKind | null, taintFraction: number) => {
    const t = Math.min(1, Math.max(0, taintFraction));
    if (kind === "victim_reported") return 46;
    if (kind === "exchange_deposit" || kind === "exchange_hot") return 32 + 8 * t;
    if (kind === "mixer" || kind === "sanctioned") return 32 + 6 * t;
    if (t < 0.05) return 8 + (t / 0.05) * 4;
    return 16 + 8 * t;
  };

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
        confidence: n.label?.confidence ?? null,
        source: n.label?.source ?? null,
        evidence: n.label?.evidence ?? null,
        kind: n.label?.kind ?? null,
        depth: n.depth,
        taintedValueUsdt: n.taintedValueUsdt,
        taintFraction: n.taintFraction,
        outflowCount: n.outflowCount,
        x: cx + depth * rxStep * Math.cos(angle),
        y: cy + depth * ryStep * Math.sin(angle),
        r: radiusOf(n.label?.kind ?? null, n.taintFraction),
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
                strokeDasharray={l.fast ? "10 6" : undefined}
                className={l.fast ? "fx-flow" : undefined}
                opacity={l.fast ? 0.9 : 0.6}
              />
            </g>
          );
        })}

        {bubbles.map((b) => {
          const dim = connected ? !connected.has(b.address) : false;
          const isSelected = selected === b.address;
          const color = colorFor(b.kind);
          // Barely-tainted wallets stay on the canvas but step out of the way.
          const background = b.taintFraction < 0.01;
          return (
            <g
              key={b.address}
              opacity={background ? 0.12 : dim ? 0.25 : 1}
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
              {/* Flat low-alpha fill, full-strength ring. No gradient, no glow. */}
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={color}
                fillOpacity={0.1}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
              />
              {isSelected ? (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 4}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth={1}
                />
              ) : null}
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
              {background ? null : (
              <text
                x={b.x}
                y={b.labelAbove ? b.y - b.r - 11 : b.y + b.r + 17}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{
                  fill: "#9aa6bb",
                  fontSize: 12,
                  // Halo, so a caption stays readable where it crosses an edge.
                  paintOrder: "stroke",
                  stroke: "#070a12",
                  strokeWidth: 3.5,
                  strokeLinejoin: "round",
                }}
              >
                {b.kind ? entityPhrase(b) : shortAddress(b.address, 6, 4)}
              </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Detail card for whatever is under the cursor. */}
      {activeBubble ? (
        <div className="pointer-events-none absolute left-6 top-6 w-72 border border-line bg-bg/95 p-6 backdrop-blur">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-faint">
            Address
          </p>
          <p className="mt-2 break-all font-mono text-xs text-ink">
            {activeBubble.address}
          </p>

          <dl className="mt-6 space-y-4 border-t border-line pt-4 text-xs">
            <div>
              <dt className="font-mono uppercase tracking-[0.2em] text-faint">Entity</dt>
              <dd className="mt-1 text-ink">{entityPhrase(activeBubble)}</dd>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <dt className="font-mono uppercase tracking-[0.2em] text-faint">
                  Confidence
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-ink">
                  {activeBubble.confidence === null
                    ? "—"
                    : formatPercent(activeBubble.confidence)}
                </dd>
              </div>
              <div className="flex-1">
                <dt className="font-mono uppercase tracking-[0.2em] text-faint">Source</dt>
                <dd className="mt-1 text-ink">
                  {activeBubble.source ? activeBubble.source.replace(/_/g, " ") : "—"}
                </dd>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <dt className="font-mono uppercase tracking-[0.2em] text-faint">
                  Tainted
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-ink">
                  {formatUsdt(activeBubble.taintedValueUsdt, { symbol: false })}
                </dd>
              </div>
              <div className="flex-1">
                <dt className="font-mono uppercase tracking-[0.2em] text-faint">Share</dt>
                <dd className="mt-1 font-mono tabular-nums text-ink">
                  {formatPercent(activeBubble.taintFraction, 1)}
                </dd>
              </div>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-[0.2em] text-faint">Evidence</dt>
              <dd className="mt-1 leading-6 text-faint">
                {activeBubble.evidence ??
                  (activeBubble.outflowCount === 0
                    ? "No outgoing transfer observed — funds at rest."
                    : "No attribution evidence on file for this wallet.")}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
