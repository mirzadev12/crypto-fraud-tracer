/**
 * Advisory anomaly ranking: which unlabelled wallets in a trace behave unlike
 * the wallets FineX has read before — an unsupervised isolation forest
 * (Liu, Ting & Zhou, 2008) over eight behavioural features the trace already
 * measures.
 *
 * What it is for, and what it is not. The problem statement asks for
 * "AI/ML-assisted risk detection". FineX has no labelled outcomes — no
 * confirmed-fraud verdicts to learn from — so a supervised score with an
 * accuracy figure would be an unmeasured claim. An isolation forest needs no
 * labels: it measures how easily a wallet's behaviour is separated from the
 * rest. That is a ranking for an investigator's attention, nothing more. It
 * never names an exit, never changes CRITICAL / SUSPICIOUS / CLOSED, and is
 * not a probability of fraud; the screen says all three.
 *
 * Deterministic on purpose: a seeded generator, so the same trace always gets
 * the same scores — an evidence tool cannot rank a wallet differently each time
 * the page is opened. Pure: no I/O, so it runs in the browser and in tests.
 */
import type { TraceResult } from "./types";

export const FEATURES = [
  "received",
  "outflows",
  "fastestForward",
  "passThrough",
  "roundShare",
  "senders",
  "age",
  "share",
] as const;
export type Feature = (typeof FEATURES)[number];

/** One wallet's feature vector; null where the trace holds nothing to measure. */
export type Row = (number | null)[];

export interface Scored {
  address: string;
  /** 0..1; about 0.5 is ordinary, higher is more easily isolated. */
  score: number;
  /** The two features that set it apart most, as plain phrases. */
  drivers: string[];
}

export interface Ranking {
  scored: Scored[];
  /** Wallets the forest was trained on: the baseline plus this trace's. */
  trainedOn: number;
  baseline: number;
}

const DAY = 86_400_000;

/** Unlabelled wallets past the reported one: the only ones worth ranking. */
export function candidates(trace: TraceResult) {
  return trace.nodes.filter((n) => n.depth > 0 && !n.label);
}

/** The eight features for each candidate wallet, in FEATURES order. */
export function featureRows(trace: TraceResult): { address: string; row: Row }[] {
  const readAt = Date.parse(trace.provenance.generatedAt);
  return candidates(trace).map((n) => {
    const into = trace.edges.filter((e) => e.to === n.address);
    const out = trace.edges.filter((e) => e.from === n.address);
    const received = into.reduce((s, e) => s + e.valueUsdt, 0);
    const sent = out.reduce((s, e) => s + e.valueUsdt, 0);
    const dwells = out.map((e) => e.dwellSeconds).filter((d): d is number => typeof d === "number" && d >= 0);
    const firstSeen = n.firstSeen ? Date.parse(n.firstSeen) : NaN;
    return {
      address: n.address,
      row: [
        Math.log1p(received),
        Math.log1p(n.outflowCount),
        dwells.length ? Math.log1p(Math.min(...dwells) / 60) : null,
        received > 0 && out.length ? Math.min(2, sent / received) : null,
        out.length ? out.filter((e) => e.valueUsdt >= 100 && e.valueUsdt % 100 === 0).length / out.length : null,
        Math.log1p(new Set(into.map((e) => e.from)).size),
        Number.isFinite(firstSeen) && Number.isFinite(readAt) ? Math.log1p(Math.max(0, readAt - firstSeen) / DAY) : null,
        n.taintFraction,
      ],
    };
  });
}

/* --------------------------------------------------------------- the forest */

/** Mulberry32: a small seeded generator, identical on every machine. */
function generator(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average path length of an unsuccessful search in a binary search tree. */
function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

type Node = { leaf: true; size: number } | { leaf: false; f: number; split: number; left: Node; right: Node };

function grow(rows: number[][], depth: number, limit: number, rand: () => number): Node {
  if (depth >= limit || rows.length <= 1) return { leaf: true, size: rows.length };
  // Only features that vary in this partition can split it.
  const varying: number[] = [];
  for (let f = 0; f < rows[0].length; f++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      if (r[f] < lo) lo = r[f];
      if (r[f] > hi) hi = r[f];
    }
    if (hi > lo) varying.push(f);
  }
  if (!varying.length) return { leaf: true, size: rows.length };
  const f = varying[Math.floor(rand() * varying.length)];
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    if (r[f] < lo) lo = r[f];
    if (r[f] > hi) hi = r[f];
  }
  const split = lo + rand() * (hi - lo);
  return {
    leaf: false,
    f,
    split,
    left: grow(rows.filter((r) => r[f] < split), depth + 1, limit, rand),
    right: grow(rows.filter((r) => r[f] >= split), depth + 1, limit, rand),
  };
}

function pathLength(x: number[], node: Node, depth = 0): number {
  if (node.leaf) return depth + c(node.size);
  return pathLength(x, x[node.f] < node.split ? node.left : node.right, depth + 1);
}

/** Isolation-forest scores for `targets`, trained on `training`. */
export function isolationScores(
  training: number[][],
  targets: number[][],
  { trees = 100, sample = 64, seed = 26183 } = {},
): number[] {
  if (training.length < 2) return targets.map(() => 0.5);
  const rand = generator(seed);
  const psi = Math.min(sample, training.length);
  const limit = Math.ceil(Math.log2(psi));
  const forest: Node[] = [];
  for (let t = 0; t < trees; t++) {
    // Sample without replacement (partial Fisher–Yates).
    const pool = training.slice();
    for (let i = 0; i < psi; i++) {
      const j = i + Math.floor(rand() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    forest.push(grow(pool.slice(0, psi), 0, limit, rand));
  }
  return targets.map((x) => {
    const mean = forest.reduce((s, tree) => s + pathLength(x, tree), 0) / forest.length;
    return Math.pow(2, -mean / c(psi));
  });
}

/* ---------------------------------------------------------------- ranking */

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** A missing feature takes the column's median, so it never decides a score. */
function impute(rows: Row[], medians: number[]): number[][] {
  return rows.map((r) => r.map((v, f) => (v === null || !Number.isFinite(v) ? medians[f] : v)));
}

const PHRASE: Record<Feature, [low: string, high: string]> = {
  received: ["received unusually little", "received far more than most wallets read"],
  outflows: ["made unusually few transfers out", "made unusually many transfers out"],
  fastestForward: ["forwarded funds unusually fast", "held funds unusually long before forwarding"],
  passThrough: ["kept most of what it received", "sent on more than this trail brought it"],
  roundShare: ["sent few round figures", "sent mostly round-figure amounts"],
  senders: ["was paid by unusually few wallets", "was paid by unusually many wallets"],
  age: ["is an unusually new wallet", "is an unusually old wallet"],
  share: ["carried an unusually small share of the money", "carried an unusually large share of the money"],
};

/**
 * Rank this trace's unlabelled wallets against `baseline` (feature rows from
 * wallets FineX has read before, data/anomaly-baseline.json) and themselves.
 */
export function rankAnomalies(trace: TraceResult, baseline: Row[]): Ranking {
  const rows = featureRows(trace);
  const all = [...baseline, ...rows.map((r) => r.row)];
  const medians = FEATURES.map((_, f) => median(all.map((r) => r[f]).filter((v): v is number => v !== null)));
  const training = impute(all, medians);
  const targets = impute(
    rows.map((r) => r.row),
    medians,
  );
  const scores = isolationScores(training, targets);
  // Robust spread per feature, to say which features set a wallet apart.
  const mads = FEATURES.map((_, f) => {
    const m = medians[f];
    return 1.4826 * median(training.map((r) => Math.abs(r[f] - m))) || 1e-9;
  });
  const scored = rows.map((r, i) => {
    const z = targets[i].map((v, f) => (r.row[f] === null ? 0 : (v - medians[f]) / mads[f]));
    const drivers = z
      .map((value, f) => ({ value, f }))
      .filter((d) => Math.abs(d.value) >= 1.5)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 2)
      .map((d) => PHRASE[FEATURES[d.f]][d.value > 0 ? 1 : 0]);
    return { address: r.address, score: Math.round(scores[i] * 100) / 100, drivers };
  });
  scored.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return { scored, trainedOn: all.length, baseline: baseline.length };
}
