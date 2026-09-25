/**
 * One freeze request per exchange.
 *
 * When fourteen complaints in a morning end at CoinDCX, the exchange should
 * receive one letter listing every account, every complaint and every incoming
 * transfer — not fourteen letters it has to reconcile. This module decides
 * which complaints go in one letter and how the letter's link carries them.
 *
 * A combined request is built from the same pinned runs as each complaint's own
 * request: every case travels as its address, amount, window, the moment it was
 * read and its acknowledgement number, and the page re-opens each through the
 * permalink route. So the combined letter shows exactly the figures each
 * complaint showed, on any later day — and a case that no longer ends at that
 * exchange is left out and says so, rather than being listed on its say-so.
 */

import { checkAddress } from "./address";
import type { TraceResult } from "./types";

export interface CombinedCase {
  address: string;
  amount?: number;
  since?: string;
  asOf?: string;
  ack?: string;
}

const ACK = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$/;
const FIELD_SEPARATOR = "~";

/** Only exchange exits can be restrained; the same test `freezable()` applies. */
function exitEntity(trace: TraceResult): string | null {
  const exit = trace.terminal;
  if (!exit) return null;
  return exit.label.kind === "exchange_deposit" || exit.label.kind === "exchange_hot"
    ? exit.label.entity
    : null;
}

/**
 * Complaints grouped by the exchange they ended at — only where two or more
 * share one. A single complaint already has its own request; offering a
 * "combined" letter of one would be the same document twice.
 */
export function groupByExchange<T extends { trace: TraceResult; ack?: string }>(
  entries: T[],
): Array<{ entity: string; entries: T[] }> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const entity = exitEntity(entry.trace);
    if (!entity) continue;
    groups.set(entity, [...(groups.get(entity) ?? []), entry]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([entity, list]) => ({ entity, entries: list }))
    .sort((a, b) => b.entries.length - a.entries.length);
}

/** The link to a combined request: each case pinned to the run it came from. */
export function combinedHref(
  entity: string,
  entries: Array<{ trace: TraceResult; ack?: string }>,
): string {
  const query = new URLSearchParams({ x: entity });
  for (const { trace, ack } of entries) {
    query.append(
      "c",
      [
        trace.inputAddress,
        trace.reportedAmountUsdt > 0 ? String(trace.reportedAmountUsdt) : "",
        trace.fraudDate ?? "",
        trace.provenance?.generatedAt ?? "",
        ack ?? "",
      ].join(FIELD_SEPARATOR),
    );
  }
  return `/freeze/exchange?${query.toString()}`;
}

/** Read the cases back from the link. Anything malformed is dropped, never trusted. */
export function readCombined(sp: Record<string, string | string[] | undefined>): {
  entity: string | null;
  cases: CombinedCase[];
} {
  const entityRaw = Array.isArray(sp.x) ? sp.x[0] : sp.x;
  const entity = entityRaw && /^[\w .&()-]{1,40}$/.test(entityRaw) ? entityRaw : null;
  const raw = sp.c === undefined ? [] : Array.isArray(sp.c) ? sp.c : [sp.c];
  const moment = (v: string) => (v && !Number.isNaN(new Date(v).getTime()) ? v : undefined);
  const cases: CombinedCase[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 50)) {
    const [address = "", amount = "", since = "", asOf = "", ack = ""] = item.split(FIELD_SEPARATOR);
    const check = checkAddress(address);
    if (!check.valid) continue;
    const key = `${check.address}|${ack}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = Number(amount);
    cases.push({
      address: check.address,
      ...(amount && Number.isFinite(n) && n > 0 ? { amount: n } : {}),
      ...(moment(since) ? { since } : {}),
      ...(moment(asOf) ? { asOf } : {}),
      ...(ACK.test(ack) ? { ack } : {}),
    });
  }
  return { entity, cases };
}
