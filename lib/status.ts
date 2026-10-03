/**
 * The deployment's pulse: each chain's newest block, read now, and what this
 * server has done today. It exists because a register of recorded cases cannot
 * show that anything on screen is live; a block height that moves can.
 *
 * Every read goes through the configured endpoints (lib/endpoints.ts), so a
 * deployment pointed at its own nodes reports its own nodes, and a chain that
 * does not answer is reported as not answering, never as a stale number.
 * Answers are kept for 30 seconds, shared by every caller, so a page polling
 * this costs the chain one request per chain per half-minute, not one per visitor.
 */
import "server-only";
import risk from "../data/risk-lists.json";
import { readAudit } from "./audit-store";
import { DEMO_MODE } from "./demo";
import { ethNodes, polygonNodes, tronKey, tronNode, type Source } from "./endpoints";
import { readInrRate, type InrRate } from "./inr";
import { labelStats } from "./labels";

export interface ChainHead {
  chain: "tron" | "ethereum" | "polygon";
  name: string;
  /** Null when no endpoint answered. */
  block: number | null;
  /** When that block was produced (ISO). */
  at: string | null;
  /** Seconds between that block and this read. */
  ageSeconds: number | null;
  source: Source;
}

export interface Status {
  generatedAt: string;
  demoMode: boolean;
  heads: ChainHead[];
  ofac: { published: string; retrieved: string };
  labels: { tron: number; ethereum: number; polygon: number };
  traces: { today: number; last: string | null };
  /** USDT/INR from an Indian exchange, or null when none answered (lib/inr.ts). */
  inr: InrRate | null;
}

const TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;

type Cache = { at: number; value: Promise<Status> };
const g = globalThis as typeof globalThis & { __finexStatus?: Cache };

export function readStatus(): Promise<Status> {
  const now = Date.now();
  const cached = g.__finexStatus;
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = build(now);
  g.__finexStatus = { at: now, value };
  // A failed build is not kept: the next caller tries again.
  value.catch(() => {
    if (g.__finexStatus?.value === value) g.__finexStatus = undefined;
  });
  return value;
}

async function build(now: number): Promise<Status> {
  const [tron, ethereum, polygon, traces, inr] = await Promise.all([
    tronHead(now),
    evmHead("ethereum", "Ethereum", ethNodes(), now),
    evmHead("polygon", "Polygon", polygonNodes(), now),
    tracesToday(now),
    readInrRate(),
  ]);
  return {
    generatedAt: new Date(now).toISOString(),
    demoMode: DEMO_MODE,
    heads: [tron, ethereum, polygon],
    ofac: { published: risk._published, retrieved: risk._retrieved },
    labels: {
      tron: labelStats("tron").total,
      ethereum: labelStats("ethereum").total,
      polygon: labelStats("polygon").total,
    },
    traces,
    inr,
  };
}

function head(
  chain: ChainHead["chain"],
  name: string,
  source: Source,
  block: number | null,
  atMs: number | null,
  now: number,
): ChainHead {
  const ok = block !== null && atMs !== null && Number.isFinite(block) && Number.isFinite(atMs);
  return {
    chain,
    name,
    source,
    block: ok ? block : null,
    at: ok ? new Date(atMs).toISOString() : null,
    ageSeconds: ok ? Math.max(0, Math.round((now - atMs) / 1000)) : null,
  };
}

async function tronHead(now: number): Promise<ChainHead> {
  const endpoint = tronNode();
  if (!endpoint.base) return head("tron", "TRON", endpoint.source, null, null, now);
  const key = tronKey(endpoint);
  try {
    const res = await fetch(`${endpoint.base}/wallet/getnowblock`, {
      headers: { Accept: "application/json", ...(key ? { "TRON-PRO-API-KEY": key } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const raw = (await res.json()) as { block_header?: { raw_data?: { number?: number; timestamp?: number } } };
    const data = raw.block_header?.raw_data;
    return head("tron", "TRON", endpoint.source, data?.number ?? null, data?.timestamp ?? null, now);
  } catch {
    return head("tron", "TRON", endpoint.source, null, null, now);
  }
}

async function evmHead(
  chain: "ethereum" | "polygon",
  name: string,
  nodes: { bases: string[]; source: Source },
  now: number,
): Promise<ChainHead> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] });
  // The agency's own node when one is set; otherwise the public nodes in turn.
  for (const url of nodes.bases) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const result = ((await res.json()) as { result?: { number?: string; timestamp?: string } }).result;
      if (!result?.number || !result.timestamp) continue;
      return head(chain, name, nodes.source, parseInt(result.number, 16), parseInt(result.timestamp, 16) * 1000, now);
    } catch {
      // The next node.
    }
  }
  return head(chain, name, nodes.source, null, null, now);
}

async function tracesToday(now: number): Promise<{ today: number; last: string | null }> {
  try {
    const { entries } = await readAudit();
    const day = new Date(now).toISOString().slice(0, 10);
    let today = 0;
    let last: string | null = null;
    for (const e of entries) {
      if (!e || e.action !== "trace") continue;
      if (e.at.startsWith(day)) today++;
      if (!last || e.at > last) last = e.at;
    }
    return { today, last };
  } catch {
    return { today: 0, last: null };
  }
}
