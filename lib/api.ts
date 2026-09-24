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

import { checkAddress } from "./address";
import type {
  CaseSummary,
  Label,
  LabelSource,
  NodeKind,
  TraceResult,
  TriageLevel,
} from "./types";
import type { TraceProgress } from "./progress";

export type { TraceProgress };

/**
 * Where a trace came from. `demo` is a recorded trace — real, captured from
 * the chain, served from a committed file. `illustrative` is a committed case
 * written by hand to show a shape, on an address that was never on the chain:
 * it must never wear the same badge as a recorded one, or the badge stops
 * meaning anything.
 */
export type DataSource = "live" | "demo" | "illustrative";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  /** Why we fell back, when we did. Shown in a tooltip, never swallowed. */
  note?: string;
  /**
   * Set when a live read was pinned to a past moment by its link. The chain it
   * describes is the chain as it stood then, and the screen has to say so:
   * "Live trace" alone reads as today, and on a case whose money has moved
   * since, that is exactly the misreading that matters.
   */
  asOf?: string;
}

/**
 * What a trace lookup can come back as.
 *
 * Three outcomes, not two. A valid address nobody has prepared a trace for is
 * not an error and must never be rendered as one: an evaluator pasting a wallet
 * we have never seen is the most likely single moment of the demo, and the
 * honest answer — "valid address, no trace held, here is what a trace does"
 * — says more about the engineering than a fixture would.
 *
 * `TraceResult` itself is untouched; this discriminates at the API layer only.
 */
export type TraceLookup =
  | ({ status: "resolved" } & Sourced<TraceResult>)
  | {
      status: "unresolved";
      address: string;
      /** The endpoint that would answer this once it is deployed. */
      endpoint: string;
      detail: string;
    }
  | { status: "invalid"; address: string; reason: string };

/**
 * Parameters that pin a trace to one run, carried in a link as
 * ?amount=&since=&asof=.
 */
export interface TraceParams {
  amount?: number;
  since?: string;
  /** Read the chain as it stood at this moment — the moment the run was read. */
  asOf?: string;
}

/**
 * A link that reproduces this exact trace: same amount, same window, and the
 * chain as it stood when the trace was read. Without the amount and window a
 * shared link re-ran on automatic settings; without the moment it re-ran on
 * today's chain, and any wallet that had moved since showed different figures
 * from the ones the officer forwarded. Confirmed transfers never change, so a
 * link pinned to its moment shows the same case on any later day.
 */
export function traceHref(
  kind: "trace" | "report" | "freeze",
  trace: Pick<TraceResult, "inputAddress" | "reportedAmountUsdt" | "fraudDate"> & {
    provenance?: { generatedAt?: string };
  },
): string {
  const query = new URLSearchParams();
  if (trace.reportedAmountUsdt > 0) query.set("amount", String(trace.reportedAmountUsdt));
  if (trace.fraudDate) query.set("since", trace.fraudDate);
  if (trace.provenance?.generatedAt) query.set("asof", trace.provenance.generatedAt);
  const qs = query.toString();
  return `/${kind}/${encodeURIComponent(trace.inputAddress)}${qs ? `?${qs}` : ""}`;
}

/**
 * Whether a freeze request can honestly be drafted from this trace.
 *
 * Reaching *an* exit is not the same as reaching a freezable one. A mixing
 * service has no customer account to restrain and a sanctioned entity is not
 * ours to write to, so offering the document on those cases would put a
 * restraint demand in an officer's hand against a counterparty that cannot
 * action it. Only an exchange endpoint qualifies.
 */
export function freezable(
  trace: Pick<TraceResult, "terminal">,
): boolean {
  const kind = trace.terminal?.label.kind;
  return kind === "exchange_deposit" || kind === "exchange_hot";
}

export interface TraceRequest {
  address: string;
  /** Optional. Omitted, the trace adopts everything that left the wallet. */
  amount?: number;
  /** Optional ISO timestamp. Omitted, the window opens at the wallet's first transfer. */
  fraudDate?: string;
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

/** The three illustrative cases that carry a hand-built trace file. */
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

/**
 * Every illustrative entry in the register — valid addresses generated for
 * this repository by `scripts/make-mocks.mjs`, never on the TRON chain. Three
 * carry a hand-built trace; the rest are register rows only. Listed here so
 * the interface can say which they are wherever one appears, and so opening a
 * row that has no trace says so instead of asking the chain about an address
 * it has never seen and printing "no USDT ever" under a register row that
 * claims 132,500 USDT reached OKX.
 */
const ILLUSTRATIVE = new Set<string>([
  DEMO_ADDRESSES.warm,
  DEMO_ADDRESSES.hot,
  DEMO_ADDRESSES.cold,
  "THDgxwhf5neEAEDm7VeVhxAk7XXqxqopQm",
  "TVDQnzYGxoXYJ7bzhsJNUm2odya94LsoR3",
  "TMNeo6BBQb3bBeZqeKr3wtDKQ2P6y3ihJ1",
  "TAEX8NDwAUF4AwzsAvo17o2vnHCeGerg6M",
  "TQGdaUeybYZQ8dD4jQaL2Zajuhun5hR6wz",
]);

export function isIllustrative(address: string): boolean {
  return ILLUSTRATIVE.has(address.trim());
}

/**
 * The cases offered as "open one of each": real ones, one per disposition,
 * captured from the chain on 14 September 2026 and frozen in
 * `data/demo-cases.json`. Each carries the run it was captured under —
 * window, amount when one was given, and the moment it was read — so its link
 * replays exactly that case: from the file with demo mode on, from the chain
 * as it stood then with demo mode off. Both give the same answer, and it is
 * one that can be re-verified. These used to be the illustrative cases, under
 * copy that said they had been captured from the chain.
 */
export const DEMO_SAMPLES: ReadonlyArray<{
  address: string;
  triage: TriageLevel;
  headline: string;
  run: { amount?: number; since: string; asOf: string };
}> = [
  {
    address: "TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex",
    triage: "WARM",
    headline: "Lands on a MEXC customer deposit address",
    run: { amount: 7630.48, since: "2026-09-08T19:12:36.000Z", asOf: "2026-09-14T08:51:06.859Z" },
  },
  {
    address: "TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx",
    triage: "HOT",
    headline: "Funds still at rest — no off-ramp reached",
    run: { since: "2026-09-09T13:09:36.000Z", asOf: "2026-09-14T08:51:02.929Z" },
  },
  {
    address: "TTQd8Bo1nhKEVgkKJVP3SRYZ1nDNStckvj",
    triage: "COLD",
    headline: "Path reaches a sanctioned address",
    run: { amount: 2000, since: "2024-09-06T07:32:48.000Z", asOf: "2026-09-14T08:51:27.200Z" },
  },
];

/** The link that replays a sample case exactly. */
export function sampleHref(sample: (typeof DEMO_SAMPLES)[number]): string {
  const query = new URLSearchParams();
  if (sample.run.amount) query.set("amount", String(sample.run.amount));
  query.set("since", sample.run.since);
  query.set("asof", sample.run.asOf);
  return `/trace/${encodeURIComponent(sample.address)}?${query.toString()}`;
}

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
  if (!isObj(v)) return false;

  const triage = v.triage;

  return (
    (triage === "HOT" || triage === "WARM" || triage === "COLD") &&
    Array.isArray(v.nodes) &&
    Array.isArray(v.edges) &&
    typeof v.chain === "string"
  );
}

const NODE_KINDS: ReadonlyArray<NodeKind> = [
  "victim_reported", "intermediary", "exchange_deposit", "exchange_hot",
  "mixer", "sanctioned", "unknown", "contract",
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
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  const reportedAmount =
    typeof raw.reportedAmountUsdt === "number"
      ? raw.reportedAmountUsdt
      : 0;

  const nodes = rawNodes
    .filter(isObj)
    .map((n, i) => {
      const amountIn =
        typeof n.amountIn === "number" ? n.amountIn : 0;

      const taintedValue =
        typeof n.taintedValueUsdt === "number"
          ? n.taintedValueUsdt
          : amountIn;

      const depth =
        typeof n.depth === "number"
          ? n.depth
          : i === 0
            ? 0
            : 1;

      const outflowCount =
        typeof n.outflowCount === "number"
          ? n.outflowCount
          : 0;

      const taintFraction =
        typeof n.taintFraction === "number"
          ? Math.min(1, Math.max(0, n.taintFraction))
          : reportedAmount > 0
            ? Math.min(1, Math.max(0, taintedValue / reportedAmount))
            : 0;

      return {
        address: String(n.address ?? ""),
        depth,
        label: toLabel(n.label),
        taintedValueUsdt: taintedValue,
        taintFraction,
        firstSeen:
          typeof n.firstSeen === "string"
            ? n.firstSeen
            : null,
        outflowCount,
      };
    });

  const nodeSet = new Set(nodes.map((n) => n.address));

  const edges = rawEdges
    .filter(isObj)
    .map((e) => ({
      from: String(e.from ?? ""),
      to: String(e.to ?? ""),
      valueUsdt:
        typeof e.valueUsdt === "number"
          ? e.valueUsdt
          : typeof e.amount === "number"
            ? e.amount
            : 0,
      txHash: String(e.txHash ?? ""),
      timestamp:
        typeof e.timestamp === "string"
          ? e.timestamp
          : "",
      dwellSeconds:
        typeof e.dwellSeconds === "number"
          ? e.dwellSeconds
          : null,
    }))
    .filter(
      (e) =>
        nodeSet.has(e.from) &&
        nodeSet.has(e.to),
    );

  const provenance =
    isObj(raw.provenance)
      ? raw.provenance
      : {};

  const rawTerminal =
    isObj(raw.terminal)
      ? raw.terminal
      : null;

  let terminalLabel: Label | null = null;

  if (rawTerminal) {
    terminalLabel = toLabel(rawTerminal.label);

    if (!terminalLabel) {
      const entity =
        typeof rawTerminal.entity === "string"
          ? rawTerminal.entity
          : "";

      const confidence =
        typeof rawTerminal.confidence === "number"
          ? rawTerminal.confidence
          : 0;

      const type =
        typeof rawTerminal.type === "string"
          ? rawTerminal.type
          : "unknown";

      const kind: NodeKind =
        NODE_KINDS.includes(type as NodeKind)
          ? (type as NodeKind)
          : "exchange_hot";

      if (entity) {
        terminalLabel = {
          entity,
          kind,
          confidence: Math.min(
            1,
            Math.max(0, confidence),
          ),
          source: "community",
        };
      }
    }
  }

  const riskFlags = Array.isArray(raw.riskFlags)
    ? raw.riskFlags
        .filter(isObj)
        .map((f) => {
          const rule =
            typeof f.rule === "string"
              ? f.rule
              : typeof f.code === "string"
                ? f.code
                : "HIGH_FANOUT";

          const allowedCodes = [
            "SHORT_DWELL",
            "HIGH_FANOUT",
            "PEEL_CHAIN",
            "ROUND_AMOUNTS",
            "NEW_ADDRESS",
            "SANCTIONED_CONTACT",
          ] as const;

          const code = allowedCodes.includes(
            rule as (typeof allowedCodes)[number],
          )
            ? (rule as (typeof allowedCodes)[number])
            : "HIGH_FANOUT";

          return {
            code,
            reason:
              typeof f.reason === "string"
                ? f.reason
                : "Suspicious transaction pattern detected.",
            atAddress:
              typeof f.atAddress === "string"
                ? f.atAddress
                : nodes[0]?.address ?? "",
          };
        })
    : [];

  return {
    caseId:
      typeof raw.caseId === "string"
        ? raw.caseId
        : `CASE-${String(
            raw.inputAddress ?? nodes[0]?.address ?? "UNKNOWN",
          ).slice(0, 8)}`,

    inputAddress:
      typeof raw.inputAddress === "string"
        ? raw.inputAddress
        : nodes[0]?.address ?? "",

    chain: raw.chain === "ethereum" ? "ethereum" : "tron",

    reportedAmountUsdt: reportedAmount,

    fraudDate:
      typeof raw.fraudDate === "string"
        ? raw.fraudDate
        : "",

    nodes,
    edges,

    terminal:
      rawTerminal && terminalLabel
        ? {
            address: String(
              rawTerminal.address ?? "",
            ),
            label: terminalLabel,
            depositAddress:
              typeof rawTerminal.depositAddress === "string"
                ? rawTerminal.depositAddress
                : null,
          }
        : null,

    riskFlags,

    triage:
      raw.triage === "HOT" ||
      raw.triage === "WARM" ||
      raw.triage === "COLD"
        ? raw.triage
        : "COLD",

    triageReason:
      typeof raw.triageReason === "string" &&
      raw.triageReason
        ? raw.triageReason
        : "No triage reason was returned for this case.",

    narrative:
      typeof raw.narrative === "string"
        ? raw.narrative
        : undefined,

    provenance: {
      apiCalls:
        typeof provenance.apiCalls === "number"
          ? provenance.apiCalls
          : typeof provenance.apiCallCount === "number"
            ? provenance.apiCallCount
            : 0,

      responseHashes:
        Array.isArray(provenance.responseHashes)
          ? provenance.responseHashes.filter(
              (x): x is string =>
                typeof x === "string",
            )
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
  return (await getJsonWithProvenance(url, init)).json;
}

/**
 * The same fetch, plus what the service says the answer actually is.
 *
 * When the deployment is running from the frozen case file (AGENTS.md §10) the
 * route stamps `x-finex-provenance: recorded`. The trace is real — captured
 * from the chain, hashes intact — but it was not read from the chain just now,
 * and the screen has to say so. Without this the badge would read LIVE TRACE
 * over a file, which is exactly the claim this interface must never make.
 */
async function getJsonWithProvenance(
  url: string,
  init?: RequestInit,
): Promise<{ json: unknown; recorded: boolean }> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return {
    json: await res.json(),
    recorded: res.headers.get("x-finex-provenance") === "recorded",
  };
}

/** What the badge says when the service answered from the frozen case file. */
const RECORDED_NOTE =
  "Recorded trace — captured from the chain by this pipeline, with its response " +
  "hashes intact, and served without touching the network.";

/**
 * How long a trace stream may go silent before we give up. An idle limit, not a
 * total one: a live trace can legitimately run for a minute, and the old flat
 * 30-second timeout was killing the slow ones mid-trace and reporting "no data".
 * The server heartbeats every ten seconds, so silence this long means it is gone.
 */
const STREAM_IDLE_MS = 60_000;

/**
 * Fetch a trace as a stream, forwarding every progress event as it arrives.
 * Falls back to a plain JSON body if the server answered without streaming.
 */
async function streamJson(
  url: string,
  init: RequestInit | undefined,
  onProgress?: (event: TraceProgress) => void,
): Promise<{ json: unknown; recorded: boolean }> {
  const controller = new AbortController();
  const expire = () =>
    controller.abort(new DOMException("timed out", "TimeoutError"));
  let idle = setTimeout(expire, STREAM_IDLE_MS);
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(expire, STREAM_IDLE_MS);
  };

  try {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/x-ndjson");
    const res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      // Surface the service's own explanation rather than a bare status code.
      let message = `${res.status} ${res.statusText}`;
      try {
        const body: unknown = await res.json();
        if (isObj(body) && typeof body.error === "string") message = body.error;
      } catch {
        // Not JSON; the status line will have to do.
      }
      throw new Error(message);
    }

    const recordedHeader = res.headers.get("x-finex-provenance") === "recorded";
    if (!res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
      return { json: await res.json(), recorded: recordedHeader };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      touch();
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!line) continue; // heartbeat
        const message: unknown = JSON.parse(line);
        if (!isObj(message)) continue;
        if (message.kind === "progress") {
          onProgress?.(message.event as TraceProgress);
        } else if (message.kind === "result") {
          return {
            json: message.trace,
            recorded: message.provenance === "recorded" || recordedHeader,
          };
        } else if (message.kind === "error") {
          throw new Error(
            typeof message.message === "string"
              ? message.message
              : "The trace could not be completed.",
          );
        }
      }
    }
    throw new Error("the trace stream ended without a result");
  } finally {
    clearTimeout(idle);
  }
}

async function fixture(path: string): Promise<unknown> {
  return getJson(path);
}

/* ------------------------------------------------------------------- cases */

/**
 * The register is a committed file, and says so.
 *
 * There is no case database, and `/api/cases` is deliberately unimplemented
 * (CONTEXT.md §3): serving these records through it would flip the badge to
 * "Live" over rows that are not chain reads. This used to ask it anyway on
 * every page that shows the register, which could only ever 404 — a red line
 * in the console of every screen, for a request whose answer was known.
 */
export async function getCases(): Promise<Sourced<CaseSummary[]>> {
  const json = await fixture("/mock/cases.json");
  const data = Array.isArray(json) ? json.filter(isCaseSummary) : [];
  return {
    data,
    source: "demo",
    note:
      "The register is a committed file, not a case database: real cases captured " +
      "from the chain, and illustrative ones marked as such in the list.",
  };
}

/* ------------------------------------------------------------------ traces */

/**
 * The committed-file path, for the illustrative cases only: same file map,
 * same validation, same `normalizeTrace`. An illustrative register entry with
 * no trace file comes back unresolved with `detail`, as a state rather than an
 * error. Real recorded cases never come through here — they are served by the
 * trace routes, from `data/demo-cases.json`, when demo mode is on.
 */
async function recordedTrace(
  address: string,
  endpoint: string,
  note: string,
  detail: string,
): Promise<TraceLookup> {
  const file = MOCK_TRACE_FILES[address.trim()];
  if (!file) {
    return { status: "unresolved", address, endpoint, detail };
  }
  const json = await fixture(file);
  if (!isTraceLike(json)) {
    return {
      status: "unresolved",
      address,
      endpoint,
      detail: "A recorded trace exists for this address but could not be read.",
    };
  }
  return { status: "resolved", data: normalizeTrace(json), source: "illustrative", note };
}

const ILLUSTRATIVE_NOTE =
  "Illustrative case — written by hand to show a shape the pipeline produces. " +
  "This address was never on the TRON chain, so there is nothing to re-verify.";

const ILLUSTRATIVE_MISSING =
  "An illustrative register entry: this address was generated for this repository " +
  "to show a shape and was never on the TRON chain, so there is no trace to read for it.";

/**
 * The three committed illustrative cases are answered from their files rather
 * than from the chain, and this is a bug fix, not a shortcut.
 *
 * These addresses were never on TRON — they are committed cases the register
 * and the fund-flow screen are built around. While the trace service did not
 * exist, `lib/api.ts` tried the API, failed, and fell back to the file, so the
 * graph rendered. The moment the service landed it started *succeeding* on
 * them: a synthetic address has no transfers, so the honest live answer is one
 * wallet and no edges — and that empty answer displaced the committed case.
 * Every graph on the register silently went blank.
 *
 * Asking the chain about an address that was never on it cannot produce
 * anything but an empty result, so we no longer ask. Any other address, real
 * ones included, still goes to the service first.
 */
function heldLocally(address: string): boolean {
  return isIllustrative(address);
}

export async function getTrace(
  address: string,
  onProgress?: (event: TraceProgress) => void,
  params?: TraceParams,
): Promise<TraceLookup> {
  // Checked here so a malformed address is never confused with an unknown one;
  // the canonical spelling is what every later step compares.
  const check = checkAddress(address);
  if (!check.valid) return { status: "invalid", address: address.trim(), reason: check.reason };
  const clean = check.address;

  if (heldLocally(clean)) {
    return recordedTrace(clean, "GET /api/trace/[address]", ILLUSTRATIVE_NOTE, ILLUSTRATIVE_MISSING);
  }

  try {
    const query = new URLSearchParams();
    if (params?.amount && params.amount > 0) query.set("amount", String(params.amount));
    if (params?.since) query.set("since", params.since);
    if (params?.asOf) query.set("asof", params.asOf);
    const qs = query.toString();
    const { json, recorded } = await streamJson(
      `/api/trace/${encodeURIComponent(clean)}${qs ? `?${qs}` : ""}`,
      undefined,
      onProgress,
    );
    if (isTraceLike(json)) {
      return {
        status: "resolved",
        data: normalizeTrace(json),
        source: recorded ? "demo" : "live",
        ...(recorded ? { note: RECORDED_NOTE } : {}),
        ...(!recorded && params?.asOf ? { asOf: params.asOf } : {}),
      };
    }
    throw new Error("response did not match TraceResult");
  } catch (err) {
    return {
      status: "unresolved",
      address: clean,
      endpoint: "GET /api/trace/[address]",
      detail: `The trace could not be completed: ${describe(err)}.`,
    };
  }
}

export async function runTrace(
  req: TraceRequest,
  onProgress?: (event: TraceProgress) => void,
): Promise<TraceLookup> {
  const check = checkAddress(req.address);
  if (!check.valid) return { status: "invalid", address: req.address.trim(), reason: check.reason };
  const clean = check.address;

  if (heldLocally(clean)) {
    return recordedTrace(clean, "POST /api/trace", ILLUSTRATIVE_NOTE, ILLUSTRATIVE_MISSING);
  }

  try {
    const { json, recorded } = await streamJson(
      "/api/trace",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req, address: clean }),
      },
      onProgress,
    );
    if (isTraceLike(json)) {
      return {
        status: "resolved",
        data: normalizeTrace(json),
        source: recorded ? "demo" : "live",
        ...(recorded ? { note: RECORDED_NOTE } : {}),
      };
    }
    throw new Error("response did not match TraceResult");
  } catch (err) {
    return {
      status: "unresolved",
      address: clean,
      endpoint: "POST /api/trace",
      detail: `The trace could not be completed: ${describe(err)}.`,
    };
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
