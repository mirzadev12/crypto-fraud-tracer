/**
 * Resolve a transaction hash to the wallet the money went to.
 *
 * The intake screen used to ask for "the wallet exactly as it appears on the
 * complaint", and that assumption does not survive contact with a real case. A
 * defrauded person reports a phone number, a UPI ID, a bank account, a Telegram
 * handle. They do not know a TRON address and were never shown one.
 *
 * Where the address actually comes from, in the common Indian pattern, is the
 * victim's own exchange: they were induced to buy USDT and withdraw it, so the
 * artefact they can produce — or that their exchange can produce for an officer
 * — is a **transaction**. That transaction names the destination. Starting from
 * the hash therefore starts the trace one step earlier, at the point where the
 * evidence really exists.
 *
 * Deliberately narrow: this reads one transaction's Transfer events and reports
 * the USDT movement in it. It does not trace, score or attribute. If the
 * transaction moved no USDT it says so rather than guessing at intent.
 */

import { hexToTronAddress, isTxHash } from "./tron";
import { USDT_CONTRACT, USDT_DECIMALS } from "./trongrid";

const BASE = "https://api.trongrid.io";

export interface ResolvedTransfer {
  txHash: string;
  from: string;
  to: string;
  valueUsdt: number;
  timestamp: string;
}

export type TxLookup =
  | { status: "resolved"; transfer: ResolvedTransfer }
  | { status: "not-a-hash"; reason: string }
  /** The transaction exists but carried no USDT — say so, never guess. */
  | { status: "no-usdt"; txHash: string; reason: string }
  | { status: "unreadable"; txHash: string; reason: string };

interface EventRow {
  event_name?: string;
  contract_address?: string;
  block_timestamp?: number;
  result?: Record<string, unknown>;
}

export async function resolveTxHash(raw: string): Promise<TxLookup> {
  const txHash = raw.trim().replace(/^0x/i, "").toLowerCase();
  if (!isTxHash(txHash)) {
    return {
      status: "not-a-hash",
      reason: "A TRON transaction hash is 64 hexadecimal characters.",
    };
  }

  let body: { data?: EventRow[] } | null = null;
  try {
    const res = await fetch(
      `${BASE}/v1/transactions/${encodeURIComponent(txHash)}/events`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      return {
        status: "unreadable",
        txHash,
        reason: `The chain did not answer for this transaction (${res.status}).`,
      };
    }
    body = (await res.json()) as { data?: EventRow[] };
  } catch (err) {
    return {
      status: "unreadable",
      txHash,
      reason:
        err instanceof Error
          ? `The chain could not be read: ${err.message}`
          : "The chain could not be read.",
    };
  }

  const rows = Array.isArray(body?.data) ? body.data : [];
  // One transaction can carry several transfers; the largest USDT movement is
  // the one a complaint is about, and the others are fees or routing noise.
  let best: ResolvedTransfer | null = null;

  for (const row of rows) {
    if (row.event_name !== "Transfer") continue;
    if (row.contract_address !== USDT_CONTRACT) continue;
    const result = row.result ?? {};
    const from = hexToTronAddress(String(result.from ?? ""));
    const to = hexToTronAddress(String(result.to ?? ""));
    const rawValue = Number(result.value ?? Number.NaN);
    if (!from || !to || !Number.isFinite(rawValue)) continue;

    const valueUsdt = rawValue / 10 ** USDT_DECIMALS;
    if (!best || valueUsdt > best.valueUsdt) {
      best = {
        txHash,
        from,
        to,
        valueUsdt,
        timestamp: new Date(Number(row.block_timestamp ?? 0)).toISOString(),
      };
    }
  }

  if (!best) {
    return {
      status: "no-usdt",
      txHash,
      reason:
        "This transaction exists but moved no USDT. Only USDT on TRON is traced here.",
    };
  }

  return { status: "resolved", transfer: best };
}
