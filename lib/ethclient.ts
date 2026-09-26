/**
 * The Ethereum side of the chain client: USDT (ERC-20) on Ethereum mainnet,
 * read from Blockscout's public REST API.
 *
 * The same rules as `lib/trongrid.ts`, for the same reasons: a per-trace cache,
 * SHA-256 of every response body, every request counted, adaptive pacing shared
 * by the whole server, and two sets — unread and truncated — so a wallet we
 * could not see is never reported as empty, and a wallet we saw part of is
 * never reported as whole.
 *
 * Verified against live responses on 24 Sep 2026, not taken from documentation:
 *   GET /addresses/{a}/token-transfers?type=ERC-20&token=<USDT>
 *   → { items: [{ transaction_hash, timestamp, block_number, log_index,
 *                 from: {hash, is_contract, name, proxy_type, public_tags,
 *                        metadata: {tags: [{name}]}}, to: {…},
 *                 token: {address_hash}, total: {decimals: "6", value} }],
 *       next_page_params: { block_number, index, … } }
 *   50 rows a page, newest first; ascending order is refused (HTTP 422). The
 *   cursor can be started at any block — `block_number=N&index=0` returns rows
 *   at or below block N-1 — which is how an "as of" read is made. The largest
 *   exchange wallets time out (HTTP 524); the tracer stops at labelled ones
 *   without reading them, and any other is reported unread. Without a key the
 *   limit is 180 requests a minute per IP, stated in the `x-ratelimit-*`
 *   headers, which the pacing reads.
 */

import { createHash } from "node:crypto";
import type { ChainClient, ContractInfo, Transfer } from "./chain-client";
import { blockscoutKey, ethHistory } from "./endpoints";
import { toChecksumAddress } from "./evm";

// Keyless traffic uses the public instance; a key uses the Pro API, which
// refuses keyless requests (HTTP 402) and takes the key as a bearer token, so
// it never appears in a URL. BLOCKSCOUT_URL replaces both with the agency's own
// Blockscout, which is sent no key (lib/endpoints.ts).
const KEY = blockscoutKey() ?? "";
const OWN = ethHistory().source === "own";
/** Null when BLOCKSCOUT_URL is set but is not a URL: every read then fails, and goes nowhere else. */
const BASE = ethHistory().base;

/** USDT (ERC-20) on Ethereum mainnet. Verified on live rows: decimals "6". */
export const ETH_USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const ETH_USDT_DECIMALS = 6;

const PAGE_SIZE = 50; // fixed by the endpoint
/** 1,000 transfers — the depth the TRON client reads (5 pages of 200). */
const MAX_PAGES = 20;
const RETRY_DELAYS_MS = [1000, 3000, 6000];
const TIMEOUT_MS = 15_000;
/** Ethereum produces a block every 12 seconds since the Merge. */
const SLOT_MS = 12_000;

// 350 ms keeps a steady stream under 180 a minute; a key allows 10 a second;
// the agency's own instance has no public limit to respect.
const MIN_GAP_MS = OWN ? 20 : KEY ? 110 : 350;
const MAX_GAP_MS = 4000;
let gapMs = MIN_GAP_MS;
/** The next moment a request may start, shared by every trace in this process. */
let nextSlotAt = 0;

async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlotAt);
  nextSlotAt = at + gapMs;
  if (at > now) await sleep(at - now);
}

function refused(): void {
  gapMs = Math.min(MAX_GAP_MS, gapMs * 2);
}

function answered(res: Response): void {
  gapMs = Math.max(MIN_GAP_MS, Math.round(gapMs * 0.9));
  // The endpoint says how much of its window is left. When it is nearly spent,
  // wait for the window to reset rather than collect a refusal.
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  const resetMs = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(remaining) && remaining <= 2 && Number.isFinite(resetMs) && resetMs > 0) {
    nextSlotAt = Math.max(nextSlotAt, Date.now() + Math.min(resetMs, 61_000));
  }
}

const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const canonical = (address: string): string => {
  const a = address.trim();
  return HEX40.test(a) ? toChecksumAddress(a) : a;
};

type Fetched =
  | { ok: true; json: unknown }
  | { ok: false; status: number | null };

export class EthClient implements ChainClient {
  readonly chain = "ethereum" as const;
  private cache = new Map<string, Transfer[]>();
  private hashes: string[] = [];
  private calls = 0;
  private unread = new Set<string>();
  private cutOff = new Set<string>();
  /** What the explorer said about each counterparty, from rows already read. */
  private seen = new Map<string, ContractInfo>();
  private readonly asOf: number | null;
  private readonly maxPages: number;
  /** The last block at or before `asOf`: undefined until resolved, null if it could not be. */
  private asOfBlock: number | null | undefined = undefined;

  constructor(opts: { asOf?: number | null; asOfBlock?: number; maxPages?: number } = {}) {
    // Fewer pages for a caller that needs only the newest transfers (a payer's
    // funding, read as of its payment). Never more than the default.
    this.maxPages =
      typeof opts.maxPages === "number" && opts.maxPages >= 1
        ? Math.min(Math.floor(opts.maxPages), MAX_PAGES)
        : MAX_PAGES;
    this.asOf =
      typeof opts.asOf === "number" && Number.isFinite(opts.asOf) ? Math.floor(opts.asOf) : null;
    // A caller that already knows the block of the moment (a transfer it has
    // read) skips the search for it: finding a pre-2022 block from the head
    // costs up to two dozen requests, because blocks were not 12 s apart then.
    if (this.asOf !== null && typeof opts.asOfBlock === "number" && Number.isFinite(opts.asOfBlock)) {
      this.asOfBlock = Math.floor(opts.asOfBlock);
    }
  }

  get apiCalls(): number {
    return this.calls;
  }

  get responseHashes(): string[] {
    return [...this.hashes];
  }

  didFail(address: string): boolean {
    return this.unread.has(canonical(address));
  }

  wasTruncated(address: string): boolean {
    return this.cutOff.has(canonical(address));
  }

  contractInfo(address: string): ContractInfo | null {
    return this.seen.get(canonical(address)) ?? null;
  }

  /** Every confirmed USDT transfer touching an address, newest first. Cached. */
  async transfers(address: string): Promise<Transfer[]> {
    const subject = canonical(address);
    const cached = this.cache.get(subject);
    if (cached) return cached;

    const out: Transfer[] = [];
    let cursor = await this.startCursor();
    let readAnything = false;
    // Pages come newest first, so anything that stops the loop early leaves the
    // oldest part unread — the part `firstSeen` comes from.
    let whole = true;
    for (let page = 0; page < this.maxPages; page++) {
      const qs = new URLSearchParams({
        type: "ERC-20",
        token: ETH_USDT_CONTRACT,
        ...(cursor ?? {}),
      });
      const res = await this.fetchJson(`/addresses/${subject}/token-transfers?${qs}`);
      const body = res.ok && isObject(res.json) ? res.json : null;
      // No body, or a body with no items array: the chain did not answer this
      // page, and an empty page would report a wallet we could not see as one
      // with nothing in it.
      if (!body || !Array.isArray(body.items)) {
        whole = false;
        break;
      }
      readAnything = true;
      for (const row of body.items) {
        const t = this.parse(row);
        // The seek already stops at the as-of block; this keeps the read exact
        // even when the seek could not be resolved.
        if (t && (this.asOf === null || t.timestamp <= this.asOf)) out.push(t);
      }
      const next = cursorFrom(body.next_page_params);
      if (!next || body.items.length < PAGE_SIZE) break;
      cursor = next;
      if (page === this.maxPages - 1) whole = false;
    }

    if (!readAnything) this.unread.add(subject);
    else if (!whole) this.cutOff.add(subject);
    this.cache.set(subject, out);
    return out;
  }

  /**
   * USDT the wallet has sent since a moment — one request, for the watch.
   * Null when the chain did not answer; an empty list only when it answered
   * that nothing left. Those are different findings.
   */
  async outflowsSince(
    address: string,
    sinceMs: number,
  ): Promise<{ transfers: Transfer[]; complete: boolean } | null> {
    const subject = canonical(address);
    const qs = new URLSearchParams({ type: "ERC-20", token: ETH_USDT_CONTRACT, filter: "from" });
    const res = await this.fetchJson(`/addresses/${subject}/token-transfers?${qs}`);
    const body = res.ok && isObject(res.json) ? res.json : null;
    if (!body || !Array.isArray(body.items)) return null;

    const rows = body.items
      .map((row) => this.parse(row))
      .filter((t): t is Transfer => t !== null && t.from === subject);
    const transfers = rows.filter((t) => t.timestamp > sinceMs);
    const oldest = rows.length ? Math.min(...rows.map((t) => t.timestamp)) : Number.NaN;
    // A full page that is all newer than `since` may have more behind it: the
    // movement is certain, the count is a floor.
    const complete = body.items.length < PAGE_SIZE || oldest <= sinceMs;
    return { transfers, complete };
  }

  /**
   * The USDT transfers inside one transaction, for intake by transaction hash.
   * `found: false` when the chain answered that there is no such transaction;
   * null when it did not answer.
   */
  async transfersInTx(hash: string): Promise<{ found: boolean; transfers: Transfer[] } | null> {
    const clean = hash.trim().toLowerCase();
    const tx = await this.fetchJson(`/transactions/${clean}`);
    if (!tx.ok) return tx.status === 404 || tx.status === 422 ? { found: false, transfers: [] } : null;
    const meta = isObject(tx.json) ? tx.json : null;
    if (!meta) return null;
    // A reverted transaction moved nothing, whatever it tried to do.
    if (meta.status !== "ok") return { found: true, transfers: [] };
    // Rows scoped to one transaction carry no timestamp of their own (verified:
    // `timestamp: null`); the transaction's is theirs.
    const at = Date.parse(String(meta.timestamp ?? ""));

    const res = await this.fetchJson(`/transactions/${clean}/token-transfers?type=ERC-20`);
    const body = res.ok && isObject(res.json) ? res.json : null;
    if (!body || !Array.isArray(body.items)) return null;
    const transfers = body.items
      .map((row) => this.parse(row, at))
      .filter((t): t is Transfer => t !== null);
    return { found: true, transfers };
  }

  /* -------------------------------------------------------------- as of */

  private async startCursor(): Promise<Record<string, string> | null> {
    if (this.asOf === null) return null;
    if (this.asOfBlock === undefined) this.asOfBlock = await this.blockAtOrBefore(this.asOf);
    if (this.asOfBlock === null) return null;
    return { block_number: String(this.asOfBlock + 1), index: "0" };
  }

  /**
   * The last block at or before a moment. Blocks come every 12 seconds, less
   * any missed slot, so a guess from the head lands within a few blocks and is
   * walked to the exact boundary: t(n) <= moment < t(n+1). Null when it cannot
   * be pinned down, in which case the read starts from the head and the
   * timestamp filter keeps it exact.
   */
  private async blockAtOrBefore(ms: number): Promise<number | null> {
    const head = await this.fetchJson("/main-page/blocks");
    const top = head.ok && Array.isArray(head.json) && isObject(head.json[0]) ? head.json[0] : null;
    const headN = Number(top?.height);
    const headT = Date.parse(String(top?.timestamp ?? ""));
    if (!Number.isFinite(headN) || !Number.isFinite(headT)) return null;
    if (ms >= headT) return headN;

    const tsOf = async (n: number): Promise<number | null> => {
      const res = await this.fetchJson(`/blocks/${n}`);
      const t = res.ok && isObject(res.json) ? Date.parse(String(res.json.timestamp ?? "")) : Number.NaN;
      return Number.isFinite(t) ? t : null;
    };

    let n = Math.max(0, headN - Math.ceil((headT - ms) / SLOT_MS));
    for (let step = 0; step < 12; step++) {
      const t = await tsOf(n);
      if (t === null) return null;
      if (t > ms) {
        n = Math.max(0, n - Math.max(1, Math.ceil((t - ms) / SLOT_MS)));
        continue;
      }
      const t1 = await tsOf(n + 1);
      if (t1 === null) return null;
      if (t1 > ms) return n;
      n += Math.max(1, Math.floor((ms - t1) / SLOT_MS) + 1);
    }
    return null;
  }

  /* ------------------------------------------------------------ parsing */

  private parse(row: unknown, fallbackTimestamp = Number.NaN): Transfer | null {
    if (!isObject(row)) return null;
    const token = isObject(row.token) ? row.token : null;
    const tokenAddress = String(token?.address_hash ?? token?.address ?? "").toLowerCase();
    if (tokenAddress !== ETH_USDT_CONTRACT.toLowerCase()) return null;

    const total = isObject(row.total) ? row.total : null;
    const decimals = Number(total?.decimals ?? ETH_USDT_DECIMALS);
    const raw = String(total?.value ?? "");
    if (decimals !== ETH_USDT_DECIMALS || !/^\d+$/.test(raw)) return null;
    // A zero-value Transfer moves nothing. Anyone can emit one from any address
    // — the address-poisoning trick — and counted as an outflow it would pose
    // as a payment the wallet never made.
    if (/^0+$/.test(raw)) return null;

    const from = this.note(row.from);
    const to = this.note(row.to);
    const txHash = typeof row.transaction_hash === "string" ? row.transaction_hash : "";
    const stamped = Date.parse(String(row.timestamp ?? ""));
    const timestamp = Number.isFinite(stamped) ? stamped : fallbackTimestamp;
    if (!from || !to || !txHash || !Number.isFinite(timestamp)) return null;

    const block = Number(row.block_number);
    return {
      txHash,
      from,
      to,
      value: Number(BigInt(raw)) / 10 ** ETH_USDT_DECIMALS,
      timestamp,
      symbol: "USDT",
      ...(Number.isFinite(block) ? { block } : {}),
    };
  }

  /** Canonical address of a counterparty, remembering what the explorer said about it. */
  private note(party: unknown): string | null {
    if (!isObject(party) || typeof party.hash !== "string" || !HEX40.test(party.hash)) return null;
    const address = toChecksumAddress(party.hash);
    if (!this.seen.has(address)) {
      const metadata = isObject(party.metadata) ? party.metadata : null;
      const metaTags = Array.isArray(metadata?.tags) ? metadata.tags : [];
      const publicTags = Array.isArray(party.public_tags) ? party.public_tags : [];
      const tags = [
        ...metaTags.map((t) => (isObject(t) ? t.name : null)),
        ...publicTags.map((t) => (isObject(t) ? (t.display_name ?? t.label) : null)),
      ]
        .filter((t): t is string => typeof t === "string" && t.trim() !== "")
        // Internal note ids are not tags a reader can use.
        .filter((t) => !/^note_\d+$/i.test(t));
      this.seen.set(address, {
        isContract: party.is_contract === true,
        name: typeof party.name === "string" && party.name ? party.name : null,
        proxyType: typeof party.proxy_type === "string" ? party.proxy_type : null,
        tags: [...new Set(tags)],
      });
    }
    return address;
  }

  /* ------------------------------------------------------------ network */

  /** One request, hashed and counted. Never throws. */
  private async fetchJson(path: string): Promise<Fetched> {
    if (!BASE) return { ok: false, status: null };
    let timeouts = 0;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      await paced();
      this.calls++;
      try {
        const res = await fetch(`${BASE}${path}`, {
          headers: {
            accept: "application/json",
            ...(KEY ? { authorization: `Bearer ${KEY}` } : {}),
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 429 || (res.status >= 500 && res.status !== 524)) {
          if (res.status === 429) refused();
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay === undefined) return { ok: false, status: res.status };
          await sleep(delay);
          continue;
        }
        // 524: the explorer ran out of time on a very large history. Asking
        // again gets the same answer, so it is an unread wallet now.
        if (!res.ok) return { ok: false, status: res.status };

        const text = await res.text();
        answered(res);
        this.hashes.push(createHash("sha256").update(text).digest("hex"));
        try {
          return { ok: true, json: JSON.parse(text) };
        } catch {
          return { ok: false, status: res.status };
        }
      } catch {
        // A timeout on one wallet tends to repeat: allow one more try, not three.
        timeouts++;
        if (timeouts > 1) return { ok: false, status: null };
        await sleep(RETRY_DELAYS_MS[0]);
      }
    }
    return { ok: false, status: null };
  }
}

function cursorFrom(params: unknown): Record<string, string> | null {
  if (!isObject(params)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) out[k] = String(v);
  }
  return Object.keys(out).length ? out : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
