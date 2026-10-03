/**
 * A per-client rate limit for the routes that read the chain.
 *
 * Every chain read shares one budget with the provider (lib/trongrid.ts paces
 * the whole server on one clock). One visitor scripting a loop of traces would
 * otherwise spend that budget for every officer, and a throttled read is the
 * one failure this tool must never mistake for an empty wallet. So each client
 * gets a token bucket per route family: a burst, then a steady refill.
 *
 * In memory, on globalThis (route handlers are bundled separately from each
 * other), keyed by the first address in X-Forwarded-For — the client, behind
 * Render's proxy — or "local" when there is none. A restart forgets every
 * bucket, which errs on the side of letting people work.
 */
export interface Bucket {
  /** Requests allowed at once. */
  burst: number;
  /** Tokens returned per minute. */
  perMinute: number;
}

/** Route families and their limits. A batch of recorded cases in demo mode is
 * fourteen traces in a few seconds; the trace burst allows a full batch. */
export const LIMITS = {
  trace: { burst: 30, perMinute: 20 },
  read: { burst: 60, perMinute: 60 },
} as const satisfies Record<string, Bucket>;

type State = Map<string, { tokens: number; at: number }>;
const g = globalThis as typeof globalThis & { __finexRate?: State };
const MAX_KEYS = 10_000;

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/** Take one token; returns the seconds to wait when the bucket is empty. */
export function take(key: string, bucket: Bucket, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  g.__finexRate ??= new Map();
  const state = g.__finexRate;
  const prev = state.get(key) ?? { tokens: bucket.burst, at: now };
  const refilled = Math.min(bucket.burst, prev.tokens + ((now - prev.at) / 60_000) * bucket.perMinute);
  if (refilled < 1) {
    state.set(key, { tokens: refilled, at: now });
    return { ok: false, retryAfter: Math.max(1, Math.ceil(((1 - refilled) / bucket.perMinute) * 60)) };
  }
  if (state.size >= MAX_KEYS && !state.has(key)) state.clear();
  state.set(key, { tokens: refilled - 1, at: now });
  return { ok: true };
}

/** For a route handler: null to proceed, or the 429 to return. */
export function limited(request: Request, family: keyof typeof LIMITS): Response | null {
  const result = take(`${family}:${clientKey(request.headers)}`, LIMITS[family]);
  if (result.ok) return null;
  return Response.json(
    {
      error: `Too many requests from this address. Try again in ${result.retryAfter} s. The limit keeps the shared chain budget available to every officer.`,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
  );
}
