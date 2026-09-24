/**
 * One check for every address FineX can trace: TRON (base58check) and Ethereum
 * (EIP-55). Every route, form and link that decides "is this a wallet we can
 * follow" asks here, so the two chains cannot drift apart in what they accept.
 *
 * It returns the canonical form as well as the verdict: an Ethereum address is
 * case-insensitive on the chain, and two spellings of one wallet must never
 * become two nodes, two cache entries or two cases.
 */

import type { ChainName } from "./chain-client";
import { checkEvmAddress } from "./evm";
import { checkTronAddress } from "./tron";

export type TraceableCheck =
  | {
      valid: true;
      chain: ChainName;
      /** The one spelling this app stores and compares. */
      address: string;
      /** False only for an Ethereum address typed without an EIP-55 checksum. */
      checksummed: boolean;
    }
  | { valid: false; chain: ChainName | null; reason: string };

export function checkAddress(raw: string): TraceableCheck {
  const s = raw.trim();
  if (!s) {
    return { valid: false, chain: null, reason: "Enter a TRON or Ethereum wallet address." };
  }
  if (/^0x/i.test(s)) {
    const r = checkEvmAddress(s);
    return r.valid
      ? { valid: true, chain: "ethereum", address: r.address, checksummed: r.checksummed }
      : { valid: false, chain: "ethereum", reason: r.reason };
  }
  if (!s.startsWith("T")) {
    return {
      valid: false,
      chain: null,
      reason: "A TRON address starts with 'T' and an Ethereum address with '0x'.",
    };
  }
  const t = checkTronAddress(s);
  return t.valid
    ? { valid: true, chain: "tron", address: s, checksummed: true }
    : { valid: false, chain: "tron", reason: t.reason };
}

export function isTraceableAddress(raw: string): boolean {
  return checkAddress(raw).valid;
}

/** The canonical spelling of a traceable address, or the input trimmed. */
export function canonicalAddress(raw: string): string {
  const c = checkAddress(raw);
  return c.valid ? c.address : raw.trim();
}
