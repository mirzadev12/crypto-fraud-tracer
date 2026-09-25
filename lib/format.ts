/**
 * Presentation helpers.
 *
 * Everything here is deterministic and timezone-independent — timestamps are
 * rendered in UTC so the server-rendered HTML and the client hydration always
 * agree, and so two investigators reading the same packet see the same time.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "29 Aug 2026, 09:21 UTC" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

/** "29 Aug 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-08-29" — for <input type="date"> values. */
export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "51,200.00 USDT" — USDT carries 6 decimals on TRON; we show 2. */
export function formatUsdt(value: number, opts: { symbol?: boolean } = {}): string {
  const withSymbol = opts.symbol !== false;
  const n = Number.isFinite(value) ? value : 0;
  const s = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${s} USDT` : s;
}

/** "51.2K" / "1.24M" — for tiles and graph nodes where space is tight. */
export function formatUsdtCompact(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

/** "0.87" → "87%" */
export function formatPercent(fraction: number, digits = 0): string {
  const n = Number.isFinite(fraction) ? fraction : 0;
  return `${(n * 100).toFixed(digits)}%`;
}

/** 1 → "1 hop", 3 → "3 hops"; `many` for irregular plurals ("1 hash", "2 hashes"). */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** "TS27ff…Giw2S" */
export function shortAddress(address: string, head = 6, tail = 5): string {
  if (!address) return "—";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** 420 → "7 min", 5400 → "1 h 30 min", null → "—" */
export function formatDwell(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 48) return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
  // Past two days, hours stop being readable: "9044 h 46 min" is 376 days.
  const d = Math.floor(h / 24);
  const hrs = h % 24;
  return hrs === 0 ? `${d} d` : `${d} d ${hrs} h`;
}

/** Elapsed time between two ISO timestamps, as a dwell-style string. */
export function elapsedBetween(fromIso: string, toIso: string): string {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return formatDwell((b - a) / 1000);
}

/**
 * The public explorer page for an address or a transaction, on its own chain.
 * The form decides the chain: an Ethereum address or hash starts `0x`, a TRON
 * address starts `T`, and a TRON transaction hash is bare hex.
 */
export function explorerAddressUrl(address: string): string {
  const a = address.trim();
  return /^0x/i.test(a)
    ? `https://etherscan.io/address/${encodeURIComponent(a)}`
    : `https://tronscan.org/#/address/${encodeURIComponent(a)}`;
}

export function explorerTxUrl(txHash: string): string {
  const h = txHash.trim();
  return /^0x/i.test(h)
    ? `https://etherscan.io/tx/${encodeURIComponent(h)}`
    : `https://tronscan.org/#/transaction/${encodeURIComponent(h)}`;
}

/**
 * Reads ?amount= and ?since= from a page URL: the two values that pin a shared
 * trace link to one run. Anything malformed is dropped rather than trusted, and
 * the trace falls back to automatic settings.
 */
export function readPinned(
  sp: Record<string, string | string[] | undefined>,
): { amount?: number; since?: string; asOf?: string; ack?: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const amount = Number(one(sp.amount));
  const moment = (raw: string | undefined) =>
    raw && !Number.isNaN(new Date(raw).getTime()) ? raw : undefined;
  const since = moment(one(sp.since));
  // The moment the run was read. Checked for shape only: whether it is in the
  // past is the route's to decide, since render must not read the clock.
  const asOf = moment(one(sp.asof));
  // The complaint's acknowledgement number, carried from a complaint sheet so
  // the packet and the freeze request name the complaint they belong to.
  // Shape only; anything else is dropped rather than printed on a document.
  const ackRaw = one(sp.ack)?.trim() ?? "";
  const ack = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$/.test(ackRaw) ? ackRaw : undefined;
  return {
    ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
    ...(since ? { since } : {}),
    ...(asOf ? { asOf } : {}),
    ...(ack ? { ack } : {}),
  };
}
