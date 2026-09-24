"use client";

import { useMemo, useState } from "react";
import { colorFor } from "./BubbleMap";
import { Designation, TRIAGE_META, entityPhrase } from "./ui";
import {
  batchRows,
  buildBatchGraph,
  groupByExit,
  isAtRest,
  isUnresolved,
  type BatchGraph,
  type BatchNode,
} from "@/lib/batch";
import { formatUsdt, formatUsdtCompact, shortAddress } from "@/lib/format";
import type { TraceResult } from "@/lib/types";

/**
 * The morning, drawn three ways.
 *
 * Each view answers a question the register cannot answer in a list, and the
 * three questions are deliberately different — a second picture of the same
 * thing is furniture.
 *
 *   Flow     Where did the morning's money go, and where do the trails meet?
 *   Exits    Where did it end up, and how much is sitting at each destination?
 *   Weight   Which complaint holds the most recoverable money?
 *
 * Drawn by hand in SVG rather than with react-flow, for the same reason
 * `BubbleMap` is: the layout here is a fixed layered one computed from hop
 * depth, a layout engine would add a dependency's worth of behaviour to place
 * nodes we can already place, and a deterministic drawing is the only kind that
 * belongs in an evidence packet — the same batch must draw the same picture
 * every time.
 */

export type BatchView = "flow" | "exits" | "weight";

const VIEW_W = 1000;
const VIEW_H = 560;

export default function BatchCanvas({
  traces,
  selected,
  onSelect,
  view: controlledView,
}: {
  traces: TraceResult[];
  selected?: string | null;
  onSelect?: (address: string | null) => void;
  view?: BatchView;
}) {
  const [ownView, setOwnView] = useState<BatchView>("flow");
  const view = controlledView ?? ownView;

  // The host owns the view so the toggle can live in its panel header; the
  // selection has nowhere else to go, so the canvas keeps it unless told
  // otherwise.
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const activeSelection = selected !== undefined ? selected : ownSelected;
  const select = (address: string | null) => {
    // Clicking the selected node again clears it — a selection you cannot drop
    // is a filter you are stuck in.
    const next = address === activeSelection ? null : address;
    if (onSelect) onSelect(next);
    if (selected === undefined) setOwnSelected(next);
  };

  const graph = useMemo(() => buildBatchGraph(traces), [traces]);
  const exits = useMemo(() => groupByExit(traces), [traces]);
  const rows = useMemo(() => batchRows(traces), [traces]);

  return (
    <div>
      {controlledView === undefined ? (
        <div className="flex justify-end border-b border-line-soft px-6 py-4">
          <BatchViewToggle view={view} onChange={setOwnView} />
        </div>
      ) : null}

      {view === "flow" ? (
        <BatchFlow graph={graph} selected={activeSelection} onSelect={select} />
      ) : view === "exits" ? (
        <BatchExits exits={exits} selected={activeSelection} onSelect={select} />
      ) : (
        <BatchWeight rows={rows} selected={activeSelection} onSelect={select} />
      )}

      <Readout graph={graph} traces={traces} view={view} />
    </div>
  );
}

/* --------------------------------------------------------------- flow view */

interface Placed extends BatchNode {
  x: number;
  y: number;
  r: number;
}

/**
 * Layered layout. Column is hop depth; row order inside a column is the mean
 * position of a node's parents in the column before it, so a trail stays on one
 * line and a convergence visibly pulls two lines together. One pass, no
 * iteration — enough to read, and deterministic.
 */
function placeFlow(graph: BatchGraph): { placed: Placed[]; index: Map<string, Placed> } {
  const byDepth = new Map<number, BatchNode[]>();
  for (const n of graph.nodes) {
    byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n]);
  }

  const parentsOf = new Map<string, string[]>();
  for (const e of graph.edges) {
    parentsOf.set(e.to, [...(parentsOf.get(e.to) ?? []), e.from]);
  }

  const rowOf = new Map<string, number>();
  const ordered = new Map<number, BatchNode[]>();

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const depth of depths) {
    const list = [...(byDepth.get(depth) ?? [])];
    if (depth === 0) {
      // The subject wallets, heaviest first — the register's own emphasis.
      list.sort(
        (a, b) =>
          b.totalTaintedUsdt - a.totalTaintedUsdt || a.address.localeCompare(b.address),
      );
    } else {
      list.sort((a, b) => {
        const mean = (n: BatchNode) => {
          const rows = (parentsOf.get(n.address) ?? [])
            .map((p) => rowOf.get(p))
            .filter((r): r is number => r !== undefined);
          return rows.length ? rows.reduce((s, r) => s + r, 0) / rows.length : Number.MAX_SAFE_INTEGER;
        };
        return (
          mean(a) - mean(b) ||
          b.totalTaintedUsdt - a.totalTaintedUsdt ||
          a.address.localeCompare(b.address)
        );
      });
    }
    list.forEach((n, i) => rowOf.set(n.address, i));
    ordered.set(depth, list);
  }

  const columns = Math.max(1, depths.length);
  const colX = (depth: number) =>
    columns === 1 ? VIEW_W / 2 : 96 + (depth / (columns - 1)) * (VIEW_W - 210);

  const placed: Placed[] = [];
  for (const depth of depths) {
    const list = ordered.get(depth) ?? [];
    const gap = VIEW_H / (list.length + 1);
    list.forEach((n, i) => {
      placed.push({
        ...n,
        x: colX(depth),
        y: gap * (i + 1),
        r: radiusFor(n, list.length),
      });
    });
  }
  return { placed, index: new Map(placed.map((p) => [p.address, p])) };
}

/**
 * Size bands follow BubbleMap's rule — size is the victim's money, never
 * arbitrary — with one addition the batch needs: a wallet several complaints
 * converge on is drawn larger than its money alone would justify, because in a
 * batch the number of victims that reached it *is* the finding.
 */
function radiusFor(n: BatchNode, crowd: number): number {
  const tight = crowd > 9;
  if (n.isSubject) return tight ? 13 : 16;
  if (n.linking) return (tight ? 19 : 23) + Math.min(6, n.cases.length * 2);
  if (n.kind === "exchange_deposit" || n.kind === "exchange_hot") return tight ? 14 : 17;
  if (n.kind === "mixer" || n.kind === "sanctioned") return tight ? 14 : 17;
  return tight ? 8 : 10;
}

function edgePath(from: Placed, to: Placed): string {
  const dx = (to.x - from.x) * 0.42;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
}

function BatchFlow({
  graph,
  selected,
  onSelect,
}: {
  graph: BatchGraph;
  selected: string | null;
  onSelect?: (address: string | null) => void;
}) {
  const { placed, index } = useMemo(() => placeFlow(graph), [graph]);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? selected;

  const maxValue = Math.max(1, ...graph.edges.map((e) => e.valueUsdt));

  /*
   * Which nodes get a caption.
   *
   * One entity can hold many addresses — the sanctions list alone puts 334 TRON
   * addresses under 44 names — so captioning every attributed wallet wrote
   * "ISIL KHORASAN" across the canvas six times and said nothing the sixth
   * time. A convergence is always captioned because it is the finding; every
   * other entity is captioned once, on the wallet that took the most money, and
   * the rest answer on hover.
   */
  const labelled = useMemo(() => {
    const keep = new Set<string>();
    const best = new Map<string, Placed>();
    for (const n of placed) {
      if (n.linking) {
        keep.add(n.address);
        continue;
      }
      // The whole first column is subject wallets; captioning one of them
      // "Victim-reported address" states what the column already says.
      const entity = n.label?.entity;
      if (!entity || n.kind === "victim_reported") continue;
      const prior = best.get(entity);
      if (!prior || n.totalTaintedUsdt > prior.totalTaintedUsdt) best.set(entity, n);
    }
    for (const n of best.values()) keep.add(n.address);
    return keep;
  }, [placed]);

  /** Everything on a trail through the active node, so a path reads end to end. */
  const lit = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of graph.edges) {
        if (set.has(e.from) && !set.has(e.to)) {
          set.add(e.to);
          grew = true;
        }
        if (set.has(e.to) && !set.has(e.from)) {
          set.add(e.from);
          grew = true;
        }
      }
    }
    return set;
  }, [active, graph.edges]);

  const activeNode = active ? index.get(active) : null;

  if (!placed.length) return <div className="h-[560px]" />;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-[560px] w-full"
        role="img"
        aria-label="Every wallet this batch of complaints touched, by hop, with wallets that more than one complaint reached drawn larger"
      >
        {graph.edges.map((e) => {
          const from = index.get(e.from);
          const to = index.get(e.to);
          if (!from || !to) return null;
          const dim = lit ? !(lit.has(e.from) && lit.has(e.to)) : false;
          return (
            <path
              key={`${e.from}>${e.to}`}
              d={edgePath(from, to)}
              fill="none"
              stroke={e.fast ? "#c98a34" : "#3a3936"}
              strokeWidth={1 + (e.valueUsdt / maxValue) * 4}
              strokeLinecap="round"
              opacity={dim ? 0.1 : e.fast ? 0.85 : 0.5}
            />
          );
        })}

        {placed.map((n) => {
          const dim = lit ? !lit.has(n.address) : false;
          const color = colorFor(n.kind);
          const isSelected = selected === n.address;
          return (
            <g
              key={n.address}
              className="cursor-pointer"
              opacity={dim ? 0.2 : 1}
              onMouseEnter={() => setHovered(n.address)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(n.address)}
              tabIndex={0}
              role="button"
              aria-label={`${entityPhrase(n.label)}, ${shortAddress(n.address)}, reached by ${n.cases.length} complaint${n.cases.length === 1 ? "" : "s"}`}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onSelect?.(n.address);
                }
              }}
            >
              {/* A convergence is the one thing this canvas exists to show, so
                  it gets the only ring on the drawing. */}
              {n.linking ? (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r + 6}
                  fill="none"
                  stroke="#c6a15b"
                  strokeOpacity={0.55}
                  strokeDasharray="3 4"
                />
              ) : null}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={color}
                fillOpacity={n.linking ? 0.18 : 0.1}
                stroke={color}
                strokeWidth={isSelected ? 3 : n.linking ? 2.5 : 1.6}
              />
              {n.linking ? (
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  style={{
                    fill: "#f0ead8",
                    fontSize: 12,
                    fontWeight: 600,
                    paintOrder: "stroke",
                    stroke: "#0a0a0a",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {n.cases.length}
                </text>
              ) : null}
              {labelled.has(n.address) ? (
                <text
                  x={n.x}
                  y={n.y + n.r + 15}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  style={{
                    fill: "#a8a296",
                    fontSize: 11,
                    paintOrder: "stroke",
                    stroke: "#0a0a0a",
                    strokeWidth: 3.5,
                    strokeLinejoin: "round",
                  }}
                >
                  {n.label?.entity ?? shortAddress(n.address, 5, 4)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {activeNode ? (
        <div className="pointer-events-none absolute left-6 top-6 w-72 border border-line bg-bg/95 p-6 backdrop-blur">
          <Designation>{entityPhrase(activeNode.label)}</Designation>
          <p className="mt-2 break-all font-mono text-xs text-ink">{activeNode.address}</p>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="font-mono uppercase tracking-[0.2em] text-faint">Complaints</dt>
              <dd className="font-mono tabular-nums text-ink">{activeNode.cases.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-mono uppercase tracking-[0.2em] text-faint">Reached</dt>
              <dd className="font-mono tabular-nums text-ink">
                {formatUsdt(activeNode.totalTaintedUsdt, { symbol: false })}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-mono uppercase tracking-[0.2em] text-faint">Hop</dt>
              <dd className="font-mono tabular-nums text-ink">{activeNode.depth}</dd>
            </div>
          </dl>
          {activeNode.cases.length > 1 ? (
            <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-faint">
              {activeNode.linking
                ? "More than one complaint in this batch reached this wallet."
                : "Shared infrastructure — expected here, and not a link between the cases."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- exits view */

function BatchExits({
  exits,
  selected,
  onSelect,
}: {
  exits: ReturnType<typeof groupByExit>;
  selected: string | null;
  onSelect?: (address: string | null) => void;
}) {
  const max = Math.max(1, ...exits.map((g) => g.totalUsdt));

  return (
    <div className="fx-scroll h-[560px] overflow-y-auto px-6 py-6">
      <ul className="space-y-6">
        {exits.map((group) => {
          const sentinel = isAtRest(group.key) || isUnresolved(group.key);
          const color = sentinel
            ? isAtRest(group.key)
              ? "#cf5f55"
              : "#6b6660"
            : colorFor(group.label?.kind ?? null);
          return (
            <li key={group.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="min-w-0 font-label text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                  {group.label ? entityPhrase(group.label) : group.title}
                  {/* One entity can hold many addresses, so the account is part
                      of the heading — two rows reading the same name are two
                      different accounts, not a repeat. */}
                  {group.address ? (
                    <span className="ml-2 font-mono normal-case tracking-normal text-faint">
                      {shortAddress(group.address)}
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-sm tabular-nums text-ink">
                  {formatUsdt(group.totalUsdt, { symbol: false })}{" "}
                  <span className="text-faint">USDT</span>
                </p>
              </div>

              {/* One cell per complaint, area proportional to what it put here:
                  the destination's weight and how many victims made it up, in
                  one row. */}
              <div className="mt-2 flex h-10 w-full items-stretch gap-1">
                {group.cases
                  .slice()
                  .sort((a, b) => b.usdt - a.usdt)
                  .map((c) => {
                    const share = group.totalUsdt > 0 ? c.usdt / group.totalUsdt : 0;
                    const isSelected = selected === c.inputAddress;
                    return (
                      <button
                        key={c.inputAddress}
                        type="button"
                        onClick={() => onSelect?.(c.inputAddress)}
                        title={`${c.inputAddress} — ${formatUsdt(c.usdt)}`}
                        aria-label={`Complaint ${c.inputAddress}, ${formatUsdt(c.usdt)}`}
                        className="fx-option-quiet min-w-[6px] transition"
                        style={{
                          flexGrow: Math.max(share, 0.02),
                          flexBasis: 0,
                          backgroundColor: color,
                          opacity: isSelected ? 1 : 0.42,
                          outline: isSelected ? "1px solid var(--color-ink)" : undefined,
                        }}
                      />
                    );
                  })}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <p className="font-mono text-xs text-faint">
                  {group.cases.length} complaint{group.cases.length === 1 ? "" : "s"}
                </p>
                <div
                  className="h-px flex-1 bg-line"
                  style={{ maxWidth: `${(group.totalUsdt / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- weight view */

function BatchWeight({
  rows,
  selected,
  onSelect,
}: {
  rows: ReturnType<typeof batchRows>;
  selected: string | null;
  onSelect?: (address: string | null) => void;
}) {
  return (
    <div className="fx-scroll h-[560px] overflow-y-auto px-6 py-6">
      <ul className="space-y-1">
        {rows.map((row) => {
          const meta = TRIAGE_META[row.triage];
          const isSelected = selected === row.inputAddress;
          return (
            <li key={row.inputAddress}>
              <button
                type="button"
                onClick={() => onSelect?.(row.inputAddress)}
                className={`fx-option-quiet block w-full px-2 py-2 text-left transition ${
                  isSelected ? "bg-white/5" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-mono text-xs text-muted">
                    {shortAddress(row.inputAddress)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink">
                    {formatUsdtCompact(row.amountUsdt)}
                    <span className="ml-2 text-faint">
                      {row.exit ?? (row.triage === "HOT" ? "at rest" : "no exit")}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-surface-2">
                  <div
                    className={`h-2 ${meta.dot}`}
                    style={{ width: `${Math.max(row.share * 100, 0.6)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- gutter */

function Readout({
  graph,
  traces,
  view,
}: {
  graph: BatchGraph;
  traces: TraceResult[];
  view: BatchView;
}) {
  const linking = graph.nodes.filter((n) => n.linking).length;
  const cells: Array<[string, string]> = [
    ["COMPLAINTS", String(traces.length)],
    ["WALLETS", String(graph.nodes.length)],
    ["TRANSFERS", String(graph.edges.length)],
    ["SHARED", String(linking)],
  ];

  return (
    <div className="fx-scroll flex h-9 items-center gap-4 overflow-x-auto border-t border-line px-6 font-mono text-xs whitespace-nowrap text-faint">
      {view === "flow" ? (
        <>
          <span className="flex items-center gap-2">
            <span className="h-px w-5 bg-suspicious" />
            {"<10 MIN"}
          </span>
          <span aria-hidden="true">·</span>
          <span>RING = REACHED BY 2+ COMPLAINTS</span>
        </>
      ) : view === "exits" ? (
        <span>WIDTH = SHARE OF WHAT REACHED THIS DESTINATION</span>
      ) : (
        <span>BAR = REPORTED AGAINST THE LARGEST IN THE BATCH</span>
      )}
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

export function BatchViewToggle({
  view,
  onChange,
}: {
  view: BatchView;
  onChange: (view: BatchView) => void;
}) {
  const options: Array<{ id: BatchView; label: string; title: string }> = [
    { id: "flow", label: "Flow", title: "Every wallet the batch touched, by hop — convergences ringed" },
    { id: "exits", label: "Exits", title: "Where the morning's money ended up, by destination" },
    { id: "weight", label: "Weight", title: "Which complaint holds the most recoverable money" },
  ];
  return (
    <div
      className="flex shrink-0 border border-line bg-surface-2 p-1"
      role="group"
      aria-label="Batch view"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={view === o.id}
          onClick={() => onChange(o.id)}
          className={`fx-option-quiet px-4 py-2 text-xs font-semibold ${
            view === o.id ? "fx-option-on bg-white/10 text-ink" : "text-faint hover:text-brass"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
