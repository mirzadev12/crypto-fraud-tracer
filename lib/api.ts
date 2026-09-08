/**
 * The single door between the UI and the backend.
 *
 * Every screen calls this module and nothing else. It tries the real API first
 * and falls back to the committed fixtures in /public/mock when the API is not
 * there yet, is failing, or answers with a shape that does not match the frozen
 * contract in lib/types.ts. The UI always knows which of the two it got, and
 * says so on screen — a demo must never look like live data.
 *
 * That is the whole integration story: when the backend lands, nothing here
 * changes and no screen changes. The badge just flips to "Live".
 */

import type {
  CaseSummary,
  Label,
  LabelSource,
  NodeKind,
  TraceResult,
  TriageLevel,
} from "./types";

export type DataSource = "live" | "demo";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  /** Why we fell back, when we did. Shown in a tooltip, never swallowed. */
  note?: string;
}

export interface TraceRequest {
  address: string;
  amount: number;
  fraudDate: string;
}

export class TraceUnavailableError extends Error {
  readonly address: string;
  constructor(address: string, message: string) {
    super(message);
    this.name = "TraceUnavailableError";
    this.address = address;
  }
}

/* ------------------------------------------------------------- demo fixtures */

/** Addresses that have a committed fixture, for the "try a sample" affordances. */
export const DEMO_ADDRESSES = {
  warm: "TS27ffk2xJ95nTMYvLjBimcpqaLNHGiw2S",
  hot: "TYz6M2Fn2egsb15oNZdACtABKotmheGQiD",
  cold: "TLtQgf2jiNt6aiAvuirZBwbL3SrBa5RKZS",
} as const;

const MOCK_TRACE_FILES: Record<string, string> = {
  [DEMO_ADDRESSES.warm]: "/mock/trace-warm.json",
  [DEMO_ADDRESSES.hot]: "/mock/trace-hot.json",
  [DEMO_ADDRESSES.cold]: "/mock/trace-cold.json",
};

export const DEMO_SAMPLES: ReadonlyArray<{
  address: string;
  triage: TriageLevel;
  headline: string;
}> = [
  { address: DEMO_ADDRESSES.warm, triage: "WARM", headline: "Lands on a Binance customer deposit address" },
  { address: DEMO_ADDRESSES.hot, triage: "HOT", headline: "Funds still at rest — no off-ramp reached" },
  { address: DEMO_ADDRESSES.cold, triage: "COLD", headline: "Path enters a mixing service" },
];

export function hasDemoTrace(address: string): boolean {
  return Boolean(MOCK_TRACE_FILES[address.trim()]);
}

/* ---------------------------------------------------------------- guards */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTriage = (v: unknown): v is TriageLevel =>
  v === "HOT" || v === "WARM" || v === "COLD";

function isCaseSummary(v: unknown): v is CaseSummary {
  return (
    isObj(v) &&
    typeof v.caseId === "string" &&
    typeof v.inputAddress === "string" &&
    typeof v.reportedAmountUsdt === "number" &&
    typeof v.fraudDate === "string" &&
    isTriage(v.triage)
  );
}

/**
 * A trace is usable if it has an input address, a triage call and arrays for
 * nodes and edges. Everything else we repair in `normalizeTrace`, so a backend
 * that is still filling in fields renders instead of white-screening.
 */
function isTraceLike(v: unknown): v is Record<string, unknown> {
  return (
    isObj(v) &&
    typeof v.inputAddress === "string" &&
    isTriage(v.triage) &&
    Array.isArray(v.nodes) &&
    Array.isArray(v.edges)
  );
}

const NODE_KINDS: ReadonlyArray<NodeKind> = [
  "victim_reported", "intermediary", "exchange_deposit", "exchange_hot",
  "mixer", "sanctioned", "unknown",
];

const LABEL_SOURCES: ReadonlyArray<LabelSource> = [
  "ground_truth", "heuristic", "sanctions", "community",
];

/**
 * A label drives the headline of the whole screen, so we accept one only when
 * every field the UI relies on is actually present and of the right type.
 */
function toLabel(v: unknown): Label | null {
  if (!isObj(v)) return null;
  const { entity, kind, confidence, source, evidence } = v;
  if (typeof entity !== "string" || !entity) return null;
  if (typeof kind !== "string" || !NODE_KINDS.includes(kind as NodeKind)) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null;
  if (typeof source !== "string" || !LABEL_SOURCES.includes(source as LabelSource)) {
    return null;
  }
  return {
    entity,
    kind: kind as NodeKind,
    confidence: Math.min(1, Math.max(0, confidence)),
    source: source as LabelSource,
    ...(typeof evidence === "string" ? { evidence } : {}),
  };
}

function normalizeTrace(raw: Record<string, unknown>): TraceResult {
  const nodes = (raw.nodes as unknown[]).filter(isObj).map((n, i) => ({
    address: String(n.address ?? ""),
    depth: typeof n.depth === "number" ? n.depth : i === 0 ? 0 : 1,
    label: toLabel(n.label),
    taintedValueUsdt: typeof n.taintedValueUsdt === "number" ? n.taintedValueUsdt : 0,
    taintFraction: typeof n.taintFraction === "number" ? n.taintFraction : 0,
    firstSeen: typeof n.firstSeen === "string" ? n.firstSeen : null,
    outflowCount: typeof n.outflowCount === "number" ? n.outflowCount : 0,
  }));

  const nodeSet = new Set(nodes.map((n) => n.address));
  const edges = (raw.edges as unknown[])
    .filter(isObj)
    .map((e) => ({
      from: String(e.from ?? ""),
      to: String(e.to ?? ""),
      valueUsdt: typeof e.valueUsdt === "number" ? e.valueUsdt : 0,
      txHash: String(e.txHash ?? ""),
      timestamp: typeof e.timestamp === "string" ? e.timestamp : "",
      dwellSeconds: typeof e.dwellSeconds === "number" ? e.dwellSeconds : null,
    }))
    // Drop edges that point at nodes we were not given — the graph cannot
    // draw them and react-flow throws on a dangling target.
    .filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to));

  const provenance = isObj(raw.provenance) ? raw.provenance : {};

  const terminalLabel = isObj(raw.terminal) ? toLabel(raw.terminal.label) : null;

  return {
    caseId: typeof raw.caseId === "string" ? raw.caseId : "UNASSIGNED",
    inputAddress: String(raw.inputAddress),
    chain: "tron",
    reportedAmountUsdt:
      typeof raw.reportedAmountUsdt === "number" ? raw.reportedAmountUsdt : 0,
    fraudDate: typeof raw.fraudDate === "string" ? raw.fraudDate : "",
    nodes,
    edges,
    terminal:
      isObj(raw.terminal) && terminalLabel
        ? {
            address: String(raw.terminal.address ?? ""),
            label: terminalLabel,
            depositAddress:
              typeof raw.terminal.depositAddress === "string"
                ? raw.terminal.depositAddress
                : null,
          }
        : null,
    riskFlags: Array.isArray(raw.riskFlags)
      ? (raw.riskFlags.filter(
          (f) => isObj(f) && typeof f.code === "string" && typeof f.reason === "string",
        ) as TraceResult["riskFlags"])
      : [],
    triage: raw.triage as TriageLevel,
    triageReason:
      typeof raw.triageReason === "string" && raw.triageReason
        ? raw.triageReason
        : "No triage reason was returned for this case.",
    narrative: typeof raw.narrative === "string" ? raw.narrative : undefined,
    provenance: {
      apiCalls: typeof provenance.apiCalls === "number" ? provenance.apiCalls : 0,
      responseHashes: Array.isArray(provenance.responseHashes)
        ? provenance.responseHashes.filter((x): x is string => typeof x === "string")
        : [],
      generatedAt:
        typeof provenance.generatedAt === "string"
          ? provenance.generatedAt
          : new Date().toISOString(),
    },
  };
}

/* ----------------------------------------------------------------- fetching */

const TIMEOUT_MS = 30_000;

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fixture(path: string): Promise<unknown> {
  return getJson(path);
}

/* ------------------------------------------------------------------- cases */

export async function getCases(): Promise<Sourced<CaseSummary[]>> {
  try {
    const json = await getJson("/api/cases");
    if (Array.isArray(json) && json.every(isCaseSummary)) {
      return { data: json, source: "live" };
    }
    throw new Error("response did not match CaseSummary[]");
  } catch (err) {
    const json = await fixture("/mock/cases.json");
    const data = Array.isArray(json) ? json.filter(isCaseSummary) : [];
    return {
      data,
      source: "demo",
      note: `/api/cases unavailable (${describe(err)}) — showing committed fixtures.`,
    };
  }
}

/* ------------------------------------------------------------------ traces */

async function demoTrace(address: string, note: string): Promise<Sourced<TraceResult>> {
  const file = MOCK_TRACE_FILES[address.trim()];
  if (!file) {
    throw new TraceUnavailableError(
      address,
      "The trace API is not reachable and no committed trace exists for this address.",
    );
  }
  const json = await fixture(file);
  if (!isTraceLike(json)) {
    throw new TraceUnavailableError(address, "The committed fixture is malformed.");
  }
  return { data: normalizeTrace(json), source: "demo", note };
}

export async function getTrace(address: string): Promise<Sourced<TraceResult>> {
  const clean = address.trim();
  try {
    const json = await getJson(`/api/trace/${encodeURIComponent(clean)}`);
    if (isTraceLike(json)) return { data: normalizeTrace(json), source: "live" };
    throw new Error("response did not match TraceResult");
  } catch (err) {
    if (err instanceof TraceUnavailableError) throw err;
    return demoTrace(
      clean,
      `/api/trace/${clean} unavailable (${describe(err)}) — showing the committed trace.`,
    );
  }
}

export async function runTrace(req: TraceRequest): Promise<Sourced<TraceResult>> {
  const clean = req.address.trim();
  try {
    const json = await getJson("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, address: clean }),
    });
    if (isTraceLike(json)) return { data: normalizeTrace(json), source: "live" };
    throw new Error("response did not match TraceResult");
  } catch (err) {
    if (err instanceof TraceUnavailableError) throw err;
    return demoTrace(
      clean,
      `POST /api/trace unavailable (${describe(err)}) — showing the committed trace.`,
    );
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError") return "timed out";
    return err.message;
  }
  return "unknown error";
}

/* ---------------------------------------------------------------- derived */

export interface QueueStats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  reportedUsdt: number;
  recoverableUsdt: number;
  exchanges: number;
}

/** Dashboard tiles. Kept here so the queue page has no business logic in it. */
export function summarize(cases: CaseSummary[]): QueueStats {
  const stats: QueueStats = {
    total: cases.length,
    hot: 0,
    warm: 0,
    cold: 0,
    reportedUsdt: 0,
    recoverableUsdt: 0,
    exchanges: 0,
  };
  const entities = new Set<string>();
  for (const c of cases) {
    stats.reportedUsdt += c.reportedAmountUsdt;
    if (c.triage === "HOT") stats.hot++;
    if (c.triage === "WARM") stats.warm++;
    if (c.triage === "COLD") stats.cold++;
    // HOT and WARM are the two states where money can still be acted on.
    if (c.triage !== "COLD") stats.recoverableUsdt += c.reportedAmountUsdt;
    if (c.terminalEntity) entities.add(c.terminalEntity);
  }
  stats.exchanges = entities.size;
  return stats;
}
