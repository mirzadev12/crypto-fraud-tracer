/**
 * Address poisoning, read from one wallet's own history.
 *
 * The attack: a thief generates an address whose first and last characters
 * match an address the target really pays — people check the ends of an
 * address, not the middle — and plants it in the target's history with a
 * dust transfer, hoping the target copies it next time. On Ethereum USDT this
 * is everywhere: on 24 Sep 2026 one exchange wallet's recent inflows came from
 * four look-alikes of its real counterparty, sending 0.0001 to 0.1 USDT.
 *
 * Two signals, each a plain count over transfers already read — no extra
 * request, no model, no score:
 *
 *  - **Spray** (the sender's side): outgoing transfers under 1 USDT, and how
 *    many different wallets they went to. A poisoner sprays thousands; an
 *    ordinary wallet almost never sends sub-dollar amounts to many strangers.
 *  - **Look-alikes** (the target's side): dust that arrived from an address
 *    sharing the first and last four characters of one of this wallet's real
 *    counterparties — someone it has moved at least 1 USDT with.
 *
 * Zero-value transfers never reach here: both chain clients drop them, because
 * they move nothing. So the signals rest on real, if tiny, transfers.
 */

import type { Transfer } from "./chain-client";

const DUST = 1; // USDT
/** Distinct dust recipients before the spray is worth stating. */
export const SPRAY_MIN_RECIPIENTS = 5;
const MATCH = 4; // characters at each end

export interface PoisoningSignals {
  spray: { transfers: number; recipients: number };
  lookalikes: Array<{ lookalike: string; imitates: string; transfers: number }>;
}

/** The two ends people compare. EVM hex compares case-insensitively; base58 does not. */
function ends(address: string): string {
  if (/^0x/i.test(address)) {
    const body = address.slice(2).toLowerCase();
    return `${body.slice(0, MATCH)}…${body.slice(-MATCH)}`;
  }
  const body = address.slice(1);
  return `${body.slice(0, MATCH)}…${body.slice(-MATCH)}`;
}

export function poisoningSignals(subject: string, transfers: Transfer[]): PoisoningSignals {
  const same = (a: string, b: string) =>
    /^0x/i.test(a) ? a.toLowerCase() === b.toLowerCase() : a === b;

  // Spray: dust out, to how many different wallets.
  const dustOut = transfers.filter((t) => same(t.from, subject) && t.value > 0 && t.value < DUST);
  const sprayRecipients = new Set(dustOut.map((t) => t.to.toLowerCase()));

  // Real counterparties: anyone this wallet moved at least 1 USDT with.
  const real = new Map<string, string>(); // ends → address
  const realSet = new Set<string>();
  for (const t of transfers) {
    if (t.value < DUST) continue;
    const other = same(t.from, subject) ? t.to : same(t.to, subject) ? t.from : null;
    if (!other || same(other, subject)) continue;
    realSet.add(other.toLowerCase());
    if (!real.has(ends(other))) real.set(ends(other), other);
  }

  // Look-alikes: dust in from an address that is not itself a real counterparty
  // but shares both ends with one.
  const found = new Map<string, { lookalike: string; imitates: string; transfers: number }>();
  for (const t of transfers) {
    if (!same(t.to, subject) || t.value <= 0 || t.value >= DUST) continue;
    if (realSet.has(t.from.toLowerCase())) continue;
    const imitates = real.get(ends(t.from));
    if (!imitates || same(imitates, t.from)) continue;
    const key = t.from.toLowerCase();
    const row = found.get(key) ?? { lookalike: t.from, imitates, transfers: 0 };
    row.transfers++;
    found.set(key, row);
  }

  return {
    spray: { transfers: dustOut.length, recipients: sprayRecipients.size },
    lookalikes: [...found.values()].sort((a, b) => b.transfers - a.transfers),
  };
}
