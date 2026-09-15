/**
 * A morning of complaints as one object.
 *
 * The trace canvases each draw a single case: one subject wallet at the centre
 * or the left edge, and the money leaving it. A batch is not ten of those. Ten
 * separate pictures say exactly what ten separate traces already said, which is
 * that ten unrelated things happened — and the whole point of running a batch is
 * that sometimes they did not.
 *
 * So the batch is drawn as a union graph: every wallet the morning touched,
 * once, with the complaints that reached it recorded on it. A wallet two trails
 * arrive at is one node with two edges into it, and that convergence is the
 * finding `lib/links.ts` states in words — here it is the shape of the
 * picture.
 *
 * Three derivations, because the canvas asks three different questions:
 *
 *   buildBatchGraph   Where did the morning's money go, hop by hop?
 *   groupByExit       Where did it end up, by service?
 *   batchRows         Which complaint holds the most recoverable money?
 *
 * Everything here is summed or counted from `TraceResult` values the tracer
 * already computed. Nothing is modelled, estimated or invented — if a figure is
 * on the canvas, a table somewhere else in the app shows the same number.
 */

import { findLinks } from "./links";
import type { Label, NodeKind, TraceResult, TriageLevel } from "./types";

/* ------------------------------------------------------------------ graph */

export interface BatchNode {
  address: string;
  /** Shallowest hop this wallet was seen at, across every complaint. */
  depth: number;
  label: Label | null;
  kind: NodeKind | null;
  /** Victim money that reached it, summed over the complaints that reached it. */
  totalTaintedUsdt: number;
  /** Complaints whose trail touched this wallet, by reported address. */
  cases: string[];
  /** True when some complaint reported this wallet as its own subject. */
  isSubject: boolean;
  /** True when more than one complaint reached it *and* that means something. */
  linking: boolean;
  /** Largest outflow count observed — zero past depth 0 means funds at rest. */
  outflowCount: number;
}

export interface BatchEdge {
  from: string;
  to: string;
  /** Summed across complaints that carried money along this pair. */
  valueUsdt: number;
  /** Any leg of it forwarded in under ten minutes. */
  fast: boolean;
  caseCount: number;
}

export interface BatchGraph {
  nodes: BatchNode[];
  edges: BatchEdge[];
  maxDepth: number;
}

/**
 * The union of every trace in the batch.
 *
 * `linking` comes from `findLinks` rather than being recomputed here, so the
 * canvas and the link panel beside it can never disagree about which
 * convergences matter. That function already excludes shared infrastructure —
 * an omnibus exchange hot wallet that nine trails reach is a fact about the
 * exchange, not a link between the cases — so every address it returns is one
 * worth ringing, and drawing any other would be the loudest possible way to
 * make a claim the text underneath refuses to make.
 */
export function buildBatchGraph(traces: TraceResult[]): BatchGraph {
  const linkingAddresses = new Set(findLinks(traces).map((l) => l.address));

  const nodes = new Map<string, BatchNode>();
  for (const trace of traces) {
    for (const n of trace.nodes) {
      const prior = nodes.get(n.address);
      if (prior) {
        prior.depth = Math.min(prior.depth, n.depth);
        prior.totalTaintedUsdt += n.taintedValueUsdt;
        prior.outflowCount = Math.max(prior.outflowCount, n.outflowCount);
        prior.isSubject = prior.isSubject || n.depth === 0;
        if (!prior.label && n.label) {
          prior.label = n.label;
          prior.kind = n.label.kind;
        }
        if (!prior.cases.includes(trace.inputAddress)) {
          prior.cases.push(trace.inputAddress);
        }
        continue;
      }
      nodes.set(n.address, {
        address: n.address,
        depth: n.depth,
        label: n.label,
        kind: n.label?.kind ?? null,
        totalTaintedUsdt: n.taintedValueUsdt,
        cases: [trace.inputAddress],
        isSubject: n.depth === 0,
        linking: linkingAddresses.has(n.address),
        outflowCount: n.outflowCount,
      });
    }
  }

  const edges = new Map<string, BatchEdge>();
  for (const trace of traces) {
    for (const e of trace.edges) {
      if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
      const key = `${e.from}>${e.to}`;
      const fast = e.dwellSeconds !== null && e.dwellSeconds < 600;
      const prior = edges.get(key);
      if (prior) {
        prior.valueUsdt += e.valueUsdt;
        prior.fast = prior.fast || fast;
        prior.caseCount += 1;
        continue;
      }
      edges.set(key, { from: e.from, to: e.to, valueUsdt: e.valueUsdt, fast, caseCount: 1 });
    }
  }

  const list = [...nodes.values()];
  return {
    nodes: list,
    edges: [...edges.values()],
    maxDepth: list.reduce((max, n) => Math.max(max, n.depth), 0),
  };
}

/* ------------------------------------------------------------------- exits */

export interface ExitCase {
  inputAddress: string;
  triage: TriageLevel;
  usdt: number;
}

export interface ExitGroup {
  /** Stable key: the exit address, or a sentinel for the two "no exit" states. */
  key: string;
  title: string;
  label: Label | null;
  /** The exit's own address, where there is one to name. */
  address: string | null;
  cases: ExitCase[];
  totalUsdt: number;
}

const AT_REST = "__at_rest__";
const UNRESOLVED = "__unresolved__";

/**
 * Where the morning's money came to rest, grouped by the thing that received it.
 *
 * Cases with no exit are not dropped into an "other" bucket — they are the two
 * states an officer most needs to see. Funds still at rest is the batch's whole
 * reason for running before lunch, and a trail that simply ran out of hops is a
 * limit of this tool, not a destination. They are grouped as themselves and
 * captioned as themselves.
 */
export function groupByExit(traces: TraceResult[]): ExitGroup[] {
  const groups = new Map<string, ExitGroup>();

  for (const trace of traces) {
    const terminal = trace.terminal;
    const key = terminal ? terminal.address : trace.triage === "HOT" ? AT_REST : UNRESOLVED;

    const title = terminal
      ? (terminal.label.entity ?? "Unnamed service")
      : key === AT_REST
        ? "Funds still at rest"
        : "No exit within three hops";

    // The money this complaint actually put here, not the sum reported: the
    // terminal's own taint where there is one, and the reported amount where
    // the money never left, because that is what is still sitting there.
    const terminalNode = terminal
      ? trace.nodes.find((n) => n.address === terminal.address)
      : undefined;
    const usdt = terminalNode?.taintedValueUsdt ?? trace.reportedAmountUsdt;

    const group = groups.get(key) ?? {
      key,
      title,
      label: terminal?.label ?? null,
      address: terminal?.address ?? null,
      cases: [],
      totalUsdt: 0,
    };
    group.cases.push({ inputAddress: trace.inputAddress, triage: trace.triage, usdt });
    group.totalUsdt += usdt;
    groups.set(key, group);
  }

  // Most money first, and the sentinels last regardless — an exchange that can
  // be written to outranks a state of not knowing.
  return [...groups.values()].sort((a, b) => {
    const sentinel = (k: string) => (k === AT_REST || k === UNRESOLVED ? 1 : 0);
    return (
      sentinel(a.key) - sentinel(b.key) ||
      b.totalUsdt - a.totalUsdt ||
      a.key.localeCompare(b.key)
    );
  });
}

export const isAtRest = (key: string) => key === AT_REST;
export const isUnresolved = (key: string) => key === UNRESOLVED;

/* -------------------------------------------------------------------- rows */

export interface BatchRow {
  inputAddress: string;
  triage: TriageLevel;
  amountUsdt: number;
  exit: string | null;
  flags: number;
  /** Share of the batch's total traced value, for the bar. */
  share: number;
}

/**
 * The register as a picture: one bar per complaint, longest first within its
 * disposition, so the morning's weight is visible before a single row is read.
 */
export function batchRows(traces: TraceResult[]): BatchRow[] {
  const rank: Record<TriageLevel, number> = { HOT: 0, WARM: 1, COLD: 2 };
  const max = Math.max(1, ...traces.map((t) => t.reportedAmountUsdt));
  return traces
    .map((t) => ({
      inputAddress: t.inputAddress,
      triage: t.triage,
      amountUsdt: t.reportedAmountUsdt,
      exit: t.terminal?.label.entity ?? null,
      flags: t.riskFlags.length,
      share: t.reportedAmountUsdt / max,
    }))
    .sort(
      (a, b) =>
        rank[a.triage] - rank[b.triage] ||
        b.amountUsdt - a.amountUsdt ||
        a.inputAddress.localeCompare(b.inputAddress),
    );
}
