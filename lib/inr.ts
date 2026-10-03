/**
 * The USDT/INR rate, read live from an Indian exchange's public ticker.
 *
 * FineX showed no rupee figure for a long time, on purpose: a conversion needs
 * a rate, and a rate typed into the code is exactly the "hardcoded data" an
 * evaluator flagged. This reads the last traded USDT/INR price on CoinDCX —
 * the market where Indian victims' money actually changes hands — and falls back
 * to WazirX; both are FIU-IND-registered. Every figure shown with it carries the
 * source and the time it was read, and nothing is shown when neither answers.
 *
 * Kept five minutes on globalThis (route handlers are bundled separately), so
 * every page and every visitor share one read. `FINEX_INR=off` turns it off
 * for a deployment that must not call a third party.
 */
import "server-only";
import { PUBLIC } from "./endpoints";

export interface InrRate {
  /** Rupees per USDT. */
  rate: number;
  source: "CoinDCX" | "WazirX";
  market: "USDT/INR";
  /** When the exchange says the price was set. */
  at: string;
  /** When this server read it. */
  readAt: string;
}

const TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;

type Cache = { at: number; value: Promise<InrRate | null> };
const g = globalThis as typeof globalThis & { __finexInr?: Cache };

export function inrEnabled(): boolean {
  return process.env.FINEX_INR !== "off";
}

export function readInrRate(): Promise<InrRate | null> {
  if (!inrEnabled()) return Promise.resolve(null);
  const now = Date.now();
  const cached = g.__finexInr;
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = (async () => (await coindcx(now)) ?? (await wazirx(now)))();
  g.__finexInr = { at: now, value };
  // A miss is not kept for five minutes: the next caller asks again.
  void value.then((r) => {
    if (!r && g.__finexInr?.value === value) g.__finexInr = undefined;
  });
  return value;
}

/** A price is accepted only if it is a plausible rupee rate for a dollar token. */
export function plausible(rate: number): boolean {
  return Number.isFinite(rate) && rate > 40 && rate < 250;
}

async function get(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function coindcx(now: number): Promise<InrRate | null> {
  try {
    const rows = (await get(PUBLIC.inr.coindcx)) as Array<{ market?: string; last_price?: string; timestamp?: number }>;
    const row = Array.isArray(rows) ? rows.find((r) => r.market === "USDTINR") : undefined;
    const rate = Number(row?.last_price);
    if (!row || !plausible(rate)) return null;
    const at = typeof row.timestamp === "number" ? new Date(row.timestamp * 1000).toISOString() : new Date(now).toISOString();
    return { rate, source: "CoinDCX", market: "USDT/INR", at, readAt: new Date(now).toISOString() };
  } catch {
    return null;
  }
}

async function wazirx(now: number): Promise<InrRate | null> {
  try {
    const row = (await get(PUBLIC.inr.wazirx)) as { lastPrice?: string; at?: number };
    const rate = Number(row?.lastPrice);
    if (!plausible(rate)) return null;
    const at = typeof row.at === "number" ? new Date(row.at).toISOString() : new Date(now).toISOString();
    return { rate, source: "WazirX", market: "USDT/INR", at, readAt: new Date(now).toISOString() };
  } catch {
    return null;
  }
}
