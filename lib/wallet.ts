/**
 * Where a wallet came from.
 *
 * Everything else in this tool looks forward: the money left the victim, where
 * did it go. That answers "where is it now" and leaves the other half of an
 * investigator's question untouched — *what is this address, and who put money
 * into it*. A wallet that first appeared six days before the fraud and was
 * funded by four unrelated payers is a different object from one that has been
 * settling merchant traffic for three years, and the trace graph shows neither.
 *
 * So this profiles a single wallet from its own transfer history: when it was
 * first and last seen, what came in and what went out, and the counterparties
 * on both sides ranked by value, each one run through the same attribution
 * table the tracer uses.
 *
 * Two honesty rules carry over from the rest of the pipeline and matter more
 * here, because this page invites conclusions about a wallet's age:
 *
 *  - An unreadable wallet is never an empty one. If the chain could not be
 *    read, the profile says so and states nothing else.
 *  - `firstSeen` is the oldest transfer *we read*. On a wallet whose history
 *    ran past the page limit that is not the day it opened, and the profile
 *    marks itself partial rather than letting a reader date the wallet from it.
 */

import { lookup } from "./labels";
import { TronGrid } from "./trongrid";
import type { Label } from "./types";

export interface Counterparty {
  address: string;
  label: Label | null;
  /** Total USDT moved between this wallet and the subject, in this direction. */
  valueUsdt: number;
  transfers: number;
  firstAt: string;
  lastAt: string;
}

export interface WalletProfile {
  address: string;
  label: Label | null;
  /** False when the chain could not be read at all — state nothing else. */
  readable: boolean;
  /** False when the history ran past the page limit, so `firstSeen` is a floor. */
  historyComplete: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  transfers: number;
  receivedUsdt: number;
  sentUsdt: number;
  /** What came in and never left. Not a balance — only USDT this tool can see. */
  retainedUsdt: number;
  /** Who funded it, largest first. The answer to "where did this come from". */
  fundedBy: Counterparty[];
  /** Where it sent money, largest first. */
  paidOut: Counterparty[];
  provenance: {
    apiCalls: number;
    responseHashes: string[];
    generatedAt: string;
  };
}

const TOP_COUNTERPARTIES = 8;

function rank(
  rows: Map<string, { value: number; count: number; first: number; last: number }>,
): Counterparty[] {
  return [...rows.entries()]
    .map(([address, row]) => ({
      address,
      label: lookup(address),
      valueUsdt: row.value,
      transfers: row.count,
      firstAt: new Date(row.first).toISOString(),
      lastAt: new Date(row.last).toISOString(),
    }))
    .sort((a, b) => b.valueUsdt - a.valueUsdt)
    .slice(0, TOP_COUNTERPARTIES);
}

export async function profileWallet(address: string): Promise<WalletProfile> {
  const subject = address.trim();
  const grid = new TronGrid();
  const transfers = await grid.transfers(subject);

  const base = {
    address: subject,
    label: lookup(subject),
    provenance: {
      apiCalls: grid.apiCalls,
      responseHashes: grid.responseHashes,
      generatedAt: new Date().toISOString(),
    },
  };

  // Could not read it. Say that and stop — an unread wallet reported as an
  // empty one is the lie this pipeline exists to avoid.
  if (grid.didFail(subject)) {
    return {
      ...base,
      readable: false,
      historyComplete: false,
      firstSeen: null,
      lastSeen: null,
      transfers: 0,
      receivedUsdt: 0,
      sentUsdt: 0,
      retainedUsdt: 0,
      fundedBy: [],
      paidOut: [],
    };
  }

  const incoming = new Map<
    string,
    { value: number; count: number; first: number; last: number }
  >();
  const outgoing = new Map<
    string,
    { value: number; count: number; first: number; last: number }
  >();

  let receivedUsdt = 0;
  let sentUsdt = 0;
  let firstAt = Number.POSITIVE_INFINITY;
  let lastAt = Number.NEGATIVE_INFINITY;

  for (const t of transfers) {
    if (t.timestamp < firstAt) firstAt = t.timestamp;
    if (t.timestamp > lastAt) lastAt = t.timestamp;

    const inbound = t.to === subject;
    const other = inbound ? t.from : t.to;
    // A self-transfer is neither a funder nor a payee.
    if (other === subject) continue;

    const book = inbound ? incoming : outgoing;
    const row = book.get(other) ?? {
      value: 0,
      count: 0,
      first: t.timestamp,
      last: t.timestamp,
    };
    row.value += t.value;
    row.count += 1;
    if (t.timestamp < row.first) row.first = t.timestamp;
    if (t.timestamp > row.last) row.last = t.timestamp;
    book.set(other, row);

    if (inbound) receivedUsdt += t.value;
    else sentUsdt += t.value;
  }

  /*
   * The data audits itself here, and it is worth stating why.
   *
   * A wallet cannot send USDT it never received. So if the outflows we read
   * exceed the inflows we read, that is not a finding about the wallet — it is
   * proof that inflows are missing from what we read, whatever the page cursor
   * claimed. The paging limit is one way a history comes back short; this is
   * the other, and it is the one the cursor does not tell us about.
   *
   * Either way the profile marks itself partial, so the first-seen date is
   * presented as a floor rather than an opening date and the totals are never
   * offered as the whole picture.
   */
  const EPSILON = 0.01;
  const balancesOut = sentUsdt <= receivedUsdt + EPSILON;

  return {
    ...base,
    readable: true,
    historyComplete: !grid.wasTruncated(subject) && balancesOut,
    firstSeen: Number.isFinite(firstAt) ? new Date(firstAt).toISOString() : null,
    lastSeen: Number.isFinite(lastAt) ? new Date(lastAt).toISOString() : null,
    transfers: transfers.length,
    receivedUsdt,
    sentUsdt,
    retainedUsdt: Math.max(0, receivedUsdt - sentUsdt),
    fundedBy: rank(incoming),
    paidOut: rank(outgoing),
  };
}
