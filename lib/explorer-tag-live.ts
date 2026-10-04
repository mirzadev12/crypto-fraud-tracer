/**
 * A TRON address's public explorer tag, read live — for the wallets where a
 * trace stopped at its search limit (`tailWallets` in lib/leads.ts).
 *
 * Our attribution table names the wallets it can prove; past the last hop the
 * money is still moving through wallets the table does not know. A public
 * explorer sometimes does ("Binance-Hot 12"), and asking costs one request. The
 * answer is shown as the explorer's own words beside the wallet — never turned
 * into an attribution, never used for the finding — so a recorded case still
 * re-derives exactly as it was captured.
 *
 * Kept an hour per address on globalThis. `null` means the explorer did not
 * answer; `{ tag: null }` means it answered and has no tag. The two are never
 * confused, by the same rule as an unread wallet.
 */
import "server-only";
import { tronTags } from "./endpoints";

export interface ExplorerTag {
  address: string;
  /** The explorer's tag, verbatim, or null when it has none. */
  tag: string | null;
  readAt: string;
}

const TTL_MS = 60 * 60_000;
const MAX = 2_000;
type Entry = { at: number; value: ExplorerTag };
const g = globalThis as typeof globalThis & { __finexTags?: Map<string, Entry> };

export function tagsEnabled(): boolean {
  return tronTags().base !== null;
}

export async function readTronTag(address: string): Promise<ExplorerTag | null> {
  const endpoint = tronTags();
  if (!endpoint.base) return null;
  g.__finexTags ??= new Map();
  const cache = g.__finexTags;
  const now = Date.now();
  const hit = cache.get(address);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  try {
    const res = await fetch(`${endpoint.base}/account?address=${encodeURIComponent(address)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { addressTag?: unknown };
    const raw = typeof body.addressTag === "string" ? body.addressTag.trim() : "";
    const value: ExplorerTag = { address, tag: raw || null, readAt: new Date(now).toISOString() };
    if (cache.size >= MAX) cache.clear();
    cache.set(address, { at: now, value });
    return value;
  } catch {
    return null;
  }
}
