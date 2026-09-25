/**
 * Who paid a wallet, and where each payer's USDT came from — one hop back.
 *
 * The trace looks forward from the reported wallet. For a wallet a fraud was
 * paid into, looking backward answers two questions the forward trace cannot:
 *
 *  - **Who else paid it.** The wallet card already lists its payers. This adds
 *    the step that makes the list useful: where each payer's own USDT came
 *    from.
 *  - **Which exchange can identify a payer.** USDT sent by an exchange's
 *    wallet is a withdrawal by one of its customers, so a payer funded
 *    straight from an exchange — or an exchange wallet paying in directly — is
 *    someone that exchange can name from its own records. On an Indian
 *    exchange that is a domestic request.
 *
 * What it does not say is who the payers are. A payer can be a victim, an
 * accomplice or a stranger; the screen calls them payers, never victims, and
 * states the one thing the chain supports — where their money came from.
 *
 * Rules carried from the rest of the pipeline: transfers under 1 USDT never
 * count (address-poisoning dust); an unreadable payer is reported as such,
 * never as one funded by nothing; a labelled payer is not read further — it is
 * the answer; a contract is not a payer's funding and is not followed.
 */

import { checkAddress } from "./address";
import type { ChainClient, ChainName, Transfer } from "./chain-client";
import { stopsTrace } from "./contracts";
import { EthClient } from "./ethclient";
import { exchangeFromTags } from "./explorer-tags";
import { lookup } from "./labels";
import { TronGrid } from "./trongrid";
import type { Label, NodeKind } from "./types";

/** Transfers below this never count: poisoning dust, as in clustering. */
const MIN_USDT = 1;
/** Payers read one hop back, largest first. Each is a chain read. */
export const PAYER_CAP = 20;
/** Funding sources kept per payer. */
const TOP_SOURCES = 3;
/**
 * Pages read per payer, back from its payment: 100 transfers on Ethereum, 400
 * on TRON. Its funding is the money it had just then, so the newest pages of
 * an as-of read hold it; reading a busy payer's whole history instead took
 * 157 s for twenty payers.
 */
const PAYER_PAGES = 2;

export interface PayerSource {
  address: string;
  /** Our own attribution, when the address is in the label table. */
  label: Label | null;
  /**
   * Ethereum only: the explorer's own tags on the address, verbatim. Our table
   * holds the wallets deposits sweep into; the wallets an exchange pays
   * withdrawals from are often different, and the explorer knows them.
   */
  tags: string[];
  usdt: number;
}

export interface TracedPayer {
  address: string;
  label: Label | null;
  paidUsdt: number;
  transfers: number;
  firstAt: string;
  lastAt: string;
  /**
   * read — its history was read and `sources` is where its USDT came from;
   * labelled — it is itself a labelled wallet (an exchange paying in), so it is
   * the answer and was not read; contract — a smart contract, not followed;
   * unreadable — the chain did not answer; skipped — beyond the cap.
   */
  status: "read" | "labelled" | "contract" | "unreadable" | "skipped";
  /** Its own inflows (1 USDT or more) up to its last payment in, largest source first. */
  sources: PayerSource[];
  /** More history before its payment than was read, so older sources are not counted. */
  partial: boolean;
}

export interface FundingExchange {
  entity: string;
  kind: NodeKind;
  /** "table": our label; "explorer": read from the explorer's tag, not vetted by us. */
  via: "table" | "explorer";
  /** Payers this exchange funded, directly or one hop back. */
  payers: number;
  /** What those payers paid into the subject. */
  paidUsdt: number;
}

export interface PayersTrace {
  address: string;
  chain: ChainName;
  readable: boolean;
  /** False when the subject's own history ran past what one read holds. */
  historyComplete: boolean;
  totalPaidUsdt: number;
  payers: TracedPayer[];
  followed: number;
  cap: number;
  exchanges: FundingExchange[];
  provenance: { apiCalls: number; responseHashes: string[]; generatedAt: string };
}

type PayerRow = { paid: number; count: number; first: number; last: number; lastBlock?: number };

/** The subject's payers (1 USDT or more per transfer), largest first. */
export function payersOf(subject: string, transfers: Transfer[]): Array<[string, PayerRow]> {
  const book = new Map<string, PayerRow>();
  for (const t of transfers) {
    if (t.to !== subject || t.from === subject || !(t.value >= MIN_USDT)) continue;
    const row = book.get(t.from) ?? { paid: 0, count: 0, first: t.timestamp, last: t.timestamp };
    row.paid += t.value;
    row.count += 1;
    row.first = Math.min(row.first, t.timestamp);
    if (t.timestamp >= row.last) {
      row.last = t.timestamp;
      row.lastBlock = t.block;
    }
    book.set(t.from, row);
  }
  return [...book.entries()].sort((a, b) => b[1].paid - a[1].paid);
}

/** Where a payer's USDT came from: its inflows up to its last payment into the subject. */
export function sourcesOf(
  payer: string,
  transfers: Transfer[],
  until: number,
  tagsOf: (address: string) => string[] = () => [],
): PayerSource[] {
  const book = new Map<string, number>();
  for (const t of transfers) {
    if (t.to !== payer || t.from === payer || !(t.value >= MIN_USDT) || t.timestamp > until) continue;
    book.set(t.from, (book.get(t.from) ?? 0) + t.value);
  }
  return [...book.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SOURCES)
    .map(([address, usdt]) => ({ address, label: lookup(address), tags: tagsOf(address), usdt }));
}

const isExchange = (label: Label | null): label is Label =>
  !!label && (label.kind === "exchange_hot" || label.kind === "exchange_deposit");

/** Every exchange that funded a payer — by paying in itself, or one hop back. */
export function fundingExchanges(payers: TracedPayer[]): FundingExchange[] {
  const book = new Map<string, FundingExchange & { seen: Set<string> }>();
  const credit = (entity: string, kind: NodeKind, via: FundingExchange["via"], payer: TracedPayer) => {
    const key = entity.toLowerCase();
    const row = book.get(key) ?? { entity, kind, via, payers: 0, paidUsdt: 0, seen: new Set<string>() };
    // Our table outranks the explorer's tag when both name the exchange.
    if (via === "table") row.via = "table";
    if (!row.seen.has(payer.address)) {
      row.seen.add(payer.address);
      row.payers += 1;
      row.paidUsdt += payer.paidUsdt;
    }
    book.set(key, row);
  };
  for (const p of payers) {
    if (p.status === "labelled" && isExchange(p.label)) credit(p.label.entity, p.label.kind, "table", p);
    if (p.status !== "read") continue;
    for (const s of p.sources) {
      if (isExchange(s.label)) credit(s.label.entity, s.label.kind, "table", p);
      else if (!s.label) {
        const named = exchangeFromTags(s.tags);
        if (named) credit(named, "exchange_hot", "explorer", p);
      }
    }
  }
  return [...book.values()]
    .map((row) => ({ entity: row.entity, kind: row.kind, via: row.via, payers: row.payers, paidUsdt: row.paidUsdt }))
    .sort((a, b) => b.payers - a.payers || b.paidUsdt - a.paidUsdt);
}

export async function tracePayers(raw: string): Promise<PayersTrace> {
  const checked = checkAddress(raw);
  const subject = checked.valid ? checked.address : raw.trim();
  const ethereum = checked.valid && checked.chain === "ethereum";
  // Each payer is read as of its last payment in, so the newest page of its
  // history is the money it had just then — its funding — however long that
  // history is. Every client's calls and response hashes are kept.
  const clients: ChainClient[] = [];
  const client = (asOf: number | null = null, maxPages?: number, asOfBlock?: number): ChainClient => {
    const c: ChainClient = ethereum
      ? new EthClient({ asOf, asOfBlock, maxPages })
      : new TronGrid({ asOf, maxPages });
    clients.push(c);
    return c;
  };
  const grid = client();
  const generatedAt = new Date().toISOString();
  const provenance = () => ({
    apiCalls: clients.reduce((sum, c) => sum + c.apiCalls, 0),
    responseHashes: clients.flatMap((c) => c.responseHashes),
    generatedAt,
  });

  const history = await grid.transfers(subject);
  if (grid.didFail(subject)) {
    return {
      address: subject,
      chain: grid.chain,
      readable: false,
      historyComplete: false,
      totalPaidUsdt: 0,
      payers: [],
      followed: 0,
      cap: PAYER_CAP,
      exchanges: [],
      provenance: provenance(),
    };
  }

  const ranked = payersOf(subject, history);
  const payers: TracedPayer[] = [];
  let followed = 0;
  for (const [address, row] of ranked) {
    const base = {
      address,
      label: lookup(address),
      paidUsdt: row.paid,
      transfers: row.count,
      firstAt: new Date(row.first).toISOString(),
      lastAt: new Date(row.last).toISOString(),
      sources: [] as PayerSource[],
      partial: false,
    };
    if (base.label) {
      payers.push({ ...base, status: "labelled" });
      continue;
    }
    if (stopsTrace(grid.contractInfo?.(address))) {
      payers.push({ ...base, status: "contract" });
      continue;
    }
    if (followed >= PAYER_CAP) {
      payers.push({ ...base, status: "skipped" });
      continue;
    }
    followed += 1;
    const reader = client(row.last, PAYER_PAGES, row.lastBlock);
    const own = await reader.transfers(address);
    if (reader.didFail(address)) {
      payers.push({ ...base, status: "unreadable" });
      continue;
    }
    payers.push({
      ...base,
      status: "read",
      sources: sourcesOf(address, own, row.last, (a) => reader.contractInfo?.(a)?.tags ?? []),
      partial: reader.wasTruncated(address),
    });
  }

  return {
    address: subject,
    chain: grid.chain,
    readable: true,
    historyComplete: !grid.wasTruncated(subject),
    totalPaidUsdt: ranked.reduce((sum, [, row]) => sum + row.paid, 0),
    payers,
    followed,
    cap: PAYER_CAP,
    exchanges: fundingExchanges(payers),
    provenance: provenance(),
  };
}
