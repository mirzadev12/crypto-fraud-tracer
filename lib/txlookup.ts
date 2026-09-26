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

import type { ChainName } from "./chain-client";
import { tronHistory, tronKey } from "./endpoints";
import { EthClient } from "./ethclient";
import { hexToTronAddress, isTxHash } from "./tron";
import { USDT_CONTRACT, USDT_DECIMALS } from "./trongrid";

export interface ResolvedTransfer {
  chain: ChainName;
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

/**
 * Either chain. The form of the hash says where to look first — Ethereum
 * prints hashes with `0x`, TRON without — and the other chain is asked only
 * when the first has nothing, so a hash pasted in the other chain's style is
 * still found. Whichever chain answers is named in the result.
 */
export async function resolveTxHash(raw: string): Promise<TxLookup> {
  const typed = raw.trim();
  if (!isTxHash(typed)) {
    return {
      status: "not-a-hash",
      reason: "A transaction hash is 64 hexadecimal characters (Ethereum prints it with 0x in front).",
    };
  }
  const bare = typed.replace(/^0x/i, "").toLowerCase();
  if (/^0x/i.test(typed)) {
    const eth = await resolveEthTx(`0x${bare}`);
    if (eth !== "not-found") return eth;
    const tron = await resolveTronTx(bare);
    return tron.status === "resolved" ? tron : { status: "no-usdt", txHash: `0x${bare}`, reason: "No transaction with this hash was found on Ethereum, and on TRON it moved no USDT." };
  }
  const tron = await resolveTronTx(bare);
  if (tron.status === "resolved" || tron.status === "unreadable") return tron;
  const eth = await resolveEthTx(`0x${bare}`);
  return eth === "not-found" || eth.status !== "resolved" ? tron : eth;
}

/** Ethereum: the transaction's USDT Transfer rows, or "not-found". */
async function resolveEthTx(txHash: string): Promise<TxLookup | "not-found"> {
  const read = await new EthClient().transfersInTx(txHash);
  if (!read) {
    return {
      status: "unreadable",
      txHash,
      reason: "The Ethereum chain did not answer for this transaction. Nothing is stated about it.",
    };
  }
  if (!read.found) return "not-found";
  const best = [...read.transfers].sort((a, b) => b.value - a.value)[0];
  if (!best) {
    return {
      status: "no-usdt",
      txHash,
      reason: "This Ethereum transaction exists but moved no USDT. Only USDT is traced here.",
    };
  }
  return {
    status: "resolved",
    transfer: {
      chain: "ethereum",
      txHash,
      from: best.from,
      to: best.to,
      valueUsdt: best.value,
      timestamp: new Date(best.timestamp).toISOString(),
    },
  };
}

async function resolveTronTx(txHash: string): Promise<TxLookup> {
  let body: { data?: EventRow[] } | null = null;
  // The agency's own endpoint when one is set, and only then (lib/endpoints.ts).
  const endpoint = tronHistory();
  if (!endpoint.base) {
    return { status: "unreadable", txHash, reason: "TRONGRID_URL is set but is not an http(s) URL, so the transaction was not read." };
  }
  const key = tronKey(endpoint);
  try {
    const res = await fetch(
      `${endpoint.base}/v1/transactions/${encodeURIComponent(txHash)}/events`,
      { headers: { Accept: "application/json", ...(key ? { "TRON-PRO-API-KEY": key } : {}) } },
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
        chain: "tron",
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
