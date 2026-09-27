/**
 * How each chain FineX traces is named on screen. One table, so a case file,
 * a packet and a freeze request can never describe the same trace two ways.
 *
 * The interface names no data provider; it does name the chain and the asset,
 * because an investigator needs the scope — and on Ethereum it also names the
 * network, because a 0x address is the same string on BNB Chain, Polygon and
 * every other EVM network, and a trace of one says nothing about the others.
 */

import type { TraceResult } from "./types";

export type TracedChain = TraceResult["chain"];

export interface ChainMeta {
  name: string;
  /** "USDT TRC-20" */
  asset: string;
  /** "TRON · USDT TRC-20", the one-line scope printed on every case. */
  scope: string;
  /** "public TRON blockchain data", for the sentence that says where a document's facts came from. */
  source: string;
  /** Said wherever an address from this chain is traced, when there is something to say. */
  note: string | null;
}

export const CHAIN_META: Record<TracedChain, ChainMeta> = {
  tron: {
    name: "TRON",
    asset: "USDT TRC-20",
    scope: "TRON · USDT TRC-20",
    source: "public TRON blockchain data",
    note: null,
  },
  ethereum: {
    name: "Ethereum",
    asset: "USDT ERC-20",
    scope: "Ethereum · USDT ERC-20",
    source: "public Ethereum blockchain data",
    note: "Ethereum mainnet. The same 0x address on Polygon is read only when Polygon is chosen; on BNB Chain or another EVM network it is not read.",
  },
  polygon: {
    name: "Polygon",
    asset: "USDT (USDT0) on Polygon",
    scope: "Polygon · USDT",
    source: "public Polygon blockchain data",
    note: "Polygon PoS. The same 0x address on Ethereum is a different wallet history, read only when Ethereum is chosen.",
  },
};

/**
 * The chain a traced address or transaction hash belongs to, from its form
 * alone — which for a 0x address means Ethereum. Polygon is never guessed from
 * a form; anything that holds a trace uses `trace.chain` instead.
 */
export function chainOf(addressOrHash: string): TracedChain {
  return /^0x/i.test(addressOrHash.trim()) ? "ethereum" : "tron";
}

export function chainMeta(chain: TracedChain | string | null | undefined): ChainMeta {
  return chain === "ethereum" ? CHAIN_META.ethereum : chain === "polygon" ? CHAIN_META.polygon : CHAIN_META.tron;
}
