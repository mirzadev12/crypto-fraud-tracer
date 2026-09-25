/**
 * What happened to a freeze request — recorded by the officer who sent it.
 *
 * FineX names the account and drafts the letter; it never learns what the
 * exchange did. Recording the answer closes that loop: across a desk's
 * requests it shows which exchanges freeze, which refuse or stay silent, and
 * how long an answer takes — the evidence I4C would need to press an exchange,
 * and the only honest ground any future ranking of cases could be trained on.
 *
 * Every figure is counted from the requests recorded, and says how many: two
 * requests to an exchange are not a measure of that exchange. Pure functions
 * here; the browser store is lib/outcome-store.ts.
 */

export const OUTCOME_STATUSES = [
  "sent",
  "acknowledged",
  "frozen",
  "partly-frozen",
  "refused",
  "no-response",
] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export const STATUS_LABEL: Record<OutcomeStatus, string> = {
  sent: "Sent, awaiting answer",
  acknowledged: "Acknowledged",
  frozen: "Frozen",
  "partly-frozen": "Partly frozen",
  refused: "Refused",
  "no-response": "No response",
};

/** The case a request was about: what the officer does not type. */
export interface OutcomeTarget {
  chain: string;
  caseId: string;
  /** The reported wallet. */
  address: string;
  /** The exchange the request went to. */
  exchange: string;
  /** The account named in it: the customer deposit address, or the exchange wallet. */
  account: string;
  /** USDT traced to that account. */
  tracedUsdt: number;
  ack?: string;
  /** Link back to the freeze request, pinned to its run. */
  href: string;
}

/** What the officer records. Dates are calendar days (YYYY-MM-DD). */
export interface OutcomeFields {
  status: OutcomeStatus;
  sentOn?: string;
  answeredOn?: string;
  frozenUsdt?: number;
  reference?: string;
  note?: string;
}

export type Outcome = OutcomeTarget & OutcomeFields & { updatedAt: string };

/** One record per account named for a case. */
export const outcomeKey = (o: Pick<OutcomeTarget, "chain" | "address" | "account">) =>
  `${o.chain}:${o.address}:${o.account}`.toLowerCase();

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** A record read back from storage or an imported file, or null if it is not one. */
export function readOutcome(v: unknown): Outcome | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const status = OUTCOME_STATUSES.find((s) => s === r.status);
  const chain = str(r.chain, 20);
  const caseId = str(r.caseId, 40);
  const address = str(r.address, 80);
  const exchange = str(r.exchange, 60);
  const account = str(r.account, 80);
  const href = str(r.href, 600);
  const updatedAt = str(r.updatedAt, 40);
  if (!status || !chain || !caseId || !address || !exchange || !account || !href || !updatedAt) return null;
  if (!href.startsWith("/freeze/") || Number.isNaN(Date.parse(updatedAt))) return null;
  const tracedUsdt = typeof r.tracedUsdt === "number" && Number.isFinite(r.tracedUsdt) ? r.tracedUsdt : 0;
  const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : undefined);
  const frozen = typeof r.frozenUsdt === "number" && Number.isFinite(r.frozenUsdt) && r.frozenUsdt >= 0 ? r.frozenUsdt : undefined;
  return {
    chain,
    caseId,
    address,
    exchange,
    account,
    tracedUsdt,
    href,
    updatedAt,
    status,
    ...(str(r.ack, 40) ? { ack: str(r.ack, 40) } : {}),
    ...(day(r.sentOn) ? { sentOn: day(r.sentOn) } : {}),
    ...(day(r.answeredOn) ? { answeredOn: day(r.answeredOn) } : {}),
    ...(frozen !== undefined ? { frozenUsdt: frozen } : {}),
    ...(str(r.reference, 80) ? { reference: str(r.reference, 80) } : {}),
    ...(str(r.note, 500) ? { note: str(r.note, 500) } : {}),
  };
}

/** Records merged by key; where both hold one, the later update wins. */
export function mergeOutcomes(current: Outcome[], incoming: Outcome[]): Outcome[] {
  const book = new Map<string, Outcome>();
  for (const o of [...current, ...incoming]) {
    const k = outcomeKey(o);
    const held = book.get(k);
    if (!held || Date.parse(o.updatedAt) > Date.parse(held.updatedAt)) book.set(k, o);
  }
  return [...book.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

const ANSWERED: ReadonlySet<OutcomeStatus> = new Set(["acknowledged", "frozen", "partly-frozen", "refused"]);

export interface ExchangeRecord {
  exchange: string;
  requests: number;
  frozen: number;
  refused: number;
  /** Sent and not yet answered, or recorded as never answered. */
  unanswered: number;
  /** Days from sending to an answer, over the requests that record both dates. */
  medianDays: number | null;
  daysMeasured: number;
  tracedUsdt: number;
  frozenUsdt: number;
}

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Per exchange, counted from the records given and nothing else. Most requests first. */
export function byExchange(outcomes: Outcome[]): ExchangeRecord[] {
  const groups = new Map<string, Outcome[]>();
  for (const o of outcomes) groups.set(o.exchange, [...(groups.get(o.exchange) ?? []), o]);
  return [...groups.entries()]
    .map(([exchange, list]) => {
      const spans = list
        .filter((o) => ANSWERED.has(o.status) && o.sentOn && o.answeredOn)
        .map((o) => days(o.sentOn as string, o.answeredOn as string))
        .filter((d) => d >= 0);
      return {
        exchange,
        requests: list.length,
        frozen: list.filter((o) => o.status === "frozen" || o.status === "partly-frozen").length,
        refused: list.filter((o) => o.status === "refused").length,
        unanswered: list.filter((o) => o.status === "sent" || o.status === "no-response").length,
        medianDays: median(spans),
        daysMeasured: spans.length,
        tracedUsdt: list.reduce((sum, o) => sum + o.tracedUsdt, 0),
        frozenUsdt: list.reduce((sum, o) => sum + (o.frozenUsdt ?? 0), 0),
      };
    })
    .sort((a, b) => b.requests - a.requests || a.exchange.localeCompare(b.exchange));
}

const cell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The desk's records as a spreadsheet, one row per request. */
export function outcomesCsv(outcomes: Outcome[]): string {
  const head = [
    "ncrp_acknowledgement", "case", "chain", "reported_wallet", "exchange", "account",
    "traced_usdt", "status", "sent_on", "answered_on", "frozen_usdt", "exchange_reference", "note", "updated_at",
  ];
  const rows = outcomes.map((o) =>
    [
      o.ack, o.caseId, o.chain, o.address, o.exchange, o.account, o.tracedUsdt.toFixed(2),
      STATUS_LABEL[o.status], o.sentOn, o.answeredOn, o.frozenUsdt?.toFixed(2), o.reference, o.note, o.updatedAt,
    ].map(cell).join(","),
  );
  return [head.join(","), ...rows].join("\n") + "\n";
}
