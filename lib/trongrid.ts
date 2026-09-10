/**
 * The only place this project talks to the chain.
 *
 * Requirements come from AGENTS.md §8, and each one exists for a reason:
 *
 *  - An in-memory cache keyed by address. A BFS hits the same wallet many
 *    times; without this we get rate-limited during the demo.
 *  - Every response body is SHA-256 hashed. That is the chain of custody the
 *    evidence packet prints, and it costs three lines.
 *  - Every call is counted into `provenance.apiCalls`.
 *  - A 429 or a non-JSON body must never crash a trace. We back off, then give
 *    up on that page and return what we have.
 *
 * Response shape was verified against a live call, not taken from the doc:
 *   data: [{ transaction_id, block_timestamp, from, to, value, token_info }]
 *   meta: { fingerprint, page_size, links: { next } }
 *
 * `value` is a decimal string in base units. USDT on TRON has 6 decimals —
 * confirmed from `token_info.decimals` on a live response — so divide by 1e6.
 * Getting this wrong makes every figure in the demo absurd.
 */

import { createHash } from "node:crypto";

const BASE = "https://api.trongrid.io";

/** USDT (TRC-20). Verified on-chain: token_info.symbol "USDT", decimals 6. */
export const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_DECIMALS = 6;

const PAGE_LIMIT = 200;
const MAX_PAGES = 5;
const RETRY_DELAYS_MS = [800, 2400];
/**
 * Minimum gap between requests. The public endpoint throttles a burst hard, and
 * a throttled wallet is a wallet we cannot report on — pacing buys back trace
 * completeness for a couple of seconds, which is the right trade.
 */
const MIN_GAP_MS = 250;

export interface Trc20Transfer {
  txHash: string;
  from: string;
  to: string;
  /** Already divided down by the token's decimals. */
  value: number;
  timestamp: number;
  symbol: string;
}

/**
 * Per-trace bookkeeping. One of these is created for each trace so the counts
 * and hashes in the evidence packet belong to that trace and nothing else.
 */
export class TronGrid {
  private cache = new Map<string, Trc20Transfer[]>();
  private hashes: string[] = [];
  private calls = 0;
  /**
   * Addresses whose history we could not read. This matters more than it looks:
   * a throttled fetch and a wallet with no outgoing transfers are the same empty
   * array, and reporting "funds still at rest" because we could not see is the
   * one lie this tool must never tell.
   */
  private unread = new Set<string>();
  private lastRequestAt = 0;

  get apiCalls(): number {
    return this.calls;
  }

  get responseHashes(): string[] {
    return [...this.hashes];
  }

  /** True when this address's history could not be read, not when it is empty. */
  didFail(address: string): boolean {
    return this.unread.has(address.trim());
  }

  /**
   * Every confirmed TRC-20 transfer touching an address, newest first.
   * Cached — a second call for the same address costs nothing.
   */
  async transfers(
    address: string,
    opts: { contract?: string | null } = {},
  ): Promise<Trc20Transfer[]> {
    const contract = opts.contract === undefined ? USDT_CONTRACT : opts.contract;
    const key = `${address}:${contract ?? "any"}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const out: Trc20Transfer[] = [];
    let url =
      `${BASE}/v1/accounts/${encodeURIComponent(address)}/transactions/trc20` +
      `?limit=${PAGE_LIMIT}&only_confirmed=true` +
      (contract ? `&contract_address=${contract}` : "");

    let readAnything = false;
    for (let page = 0; page < MAX_PAGES && url; page++) {
      const body = await this.getJson(url);
      if (!body) break;
      readAnything = true;

      const rows = Array.isArray(body.data) ? body.data : [];
      for (const row of rows) {
        const parsed = parseTransfer(row);
        if (parsed) out.push(parsed);
      }

      const meta = isObject(body.meta) ? body.meta : null;
      const links = meta && isObject(meta.links) ? meta.links : null;
      const next = links && typeof links.next === "string" ? links.next : "";
      if (!next || rows.length < PAGE_LIMIT) break;
      url = next;
    }

    if (!readAnything) this.unread.add(address.trim());
    this.cache.set(key, out);
    return out;
  }

  /**
   * One request, hashed and counted. Returns null rather than throwing — a
   * single failed page must not take a whole trace down with it.
   */
  private async getJson(url: string): Promise<Record<string, unknown> | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const gap = MIN_GAP_MS - (Date.now() - this.lastRequestAt);
      if (gap > 0) await sleep(gap);
      this.lastRequestAt = Date.now();
      this.calls++;
      try {
        const res = await fetch(url, {
          headers: {
            accept: "application/json",
            // Optional. Without a key the public endpoint throttles hard, which
            // is fine on a laptop and not fine on a shared deployment IP.
            ...(process.env.TRONGRID_API_KEY
              ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
              : {}),
          },
          signal: AbortSignal.timeout(20_000),
        });

        // Rate limited or a transient upstream fault: wait and try again.
        if (res.status === 429 || res.status >= 500) {
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay === undefined) return null;
          await sleep(delay);
          continue;
        }
        if (!res.ok) return null;

        const text = await res.text();
        // Hash exactly what came back, before anything is parsed out of it.
        this.hashes.push(createHash("sha256").update(text).digest("hex"));

        try {
          const json = JSON.parse(text);
          return isObject(json) ? json : null;
        } catch {
          // HTML error page, truncated body, anything else.
          return null;
        }
      } catch {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) return null;
        await sleep(delay);
      }
    }
    return null;
  }
}

/* ------------------------------------------------------------------ parsing */

function parseTransfer(row: unknown): Trc20Transfer | null {
  if (!isObject(row)) return null;
  const info = isObject(row.token_info) ? row.token_info : null;
  const decimals =
    info && typeof info.decimals === "number" ? info.decimals : USDT_DECIMALS;

  const from = typeof row.from === "string" ? row.from : "";
  const to = typeof row.to === "string" ? row.to : "";
  const txHash = typeof row.transaction_id === "string" ? row.transaction_id : "";
  if (!from || !to || !txHash) return null;

  // `value` is a decimal string of integer base units and can exceed 2^53, so
  // it is divided down through BigInt rather than parsed as a float.
  const raw = typeof row.value === "string" ? row.value : String(row.value ?? "");
  if (!/^\d+$/.test(raw)) return null;

  return {
    txHash,
    from,
    to,
    value: Number(BigInt(raw)) / 10 ** decimals,
    timestamp:
      typeof row.block_timestamp === "number" ? row.block_timestamp : 0,
    symbol: info && typeof info.symbol === "string" ? info.symbol : "USDT",
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
