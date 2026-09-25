/**
 * Has the issuer frozen this address? The one freeze that does not depend on
 * an exchange.
 *
 * Tether's USDT contract keeps a blacklist on both chains FineX traces, and a
 * blacklisted address cannot move its USDT at all — whatever wallet software
 * holds it, wherever it sits. So for money found at rest in a private wallet,
 * where there is no exchange to write to, the issuer is the one party that can
 * still stop it, and whether it already has is the first thing an officer
 * needs to know.
 *
 * The answer is read from the contract itself, never inferred:
 *
 *   isBlackListed(address) → bool      selector 0xe47d6060
 *
 * Verified on 25 Sep 2026 against addresses the contract's own AddedBlackList
 * events had just named: true for each of them on Ethereum (block 26,049,478)
 * and on TRON, false for Binance 14 and Binance-Hot 7.
 *
 * Three answers, never two, by the rule the watch follows: frozen, not frozen,
 * or not checked. A node that did not answer is "unchecked", never "not frozen".
 * The answer is the chain as it stands now — not as of any recorded moment —
 * and it carries the time it was read and the SHA-256 of the response.
 */

import { createHash } from "node:crypto";
import { checkAddress } from "./address";
import type { ChainName } from "./chain-client";
import { base58Decode } from "./tron";
import { ETH_USDT_CONTRACT } from "./ethclient";
import { USDT_CONTRACT } from "./trongrid";

const IS_BLACKLISTED = "e47d6060";

/** Public Ethereum nodes, in the order they are asked. Any one answer is enough. */
const ETH_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://cloudflare-eth.com",
  "https://1rpc.io/eth",
];

export type IssuerStatus =
  | {
      status: "frozen" | "not-frozen";
      chain: ChainName;
      address: string;
      checkedAt: string;
      /**
       * SHA-256 of the request and the response together. A bare "false" reply
       * is the same bytes for every address, so the request is hashed with it
       * to make the digest name the address it answers for.
       */
      responseHash: string;
    }
  | { status: "unchecked"; chain: ChainName | null; address: string; reason: string };

const sha256 = (request: string, response: string) =>
  createHash("sha256").update(request).update(" | ").update(response).digest("hex");

/** The contract's boolean, from a 32-byte word; null when it is not one. */
function bool(word: unknown): boolean | null {
  if (typeof word !== "string") return null;
  const hex = word.replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  return /1$/.test(hex) && /^0{63}/.test(hex) ? true : /^0{64}$/.test(hex) ? false : null;
}

async function readEthereum(address: string): Promise<{ frozen: boolean; hash: string } | null> {
  const data = `0x${IS_BLACKLISTED}${address.slice(2).toLowerCase().padStart(64, "0")}`;
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: ETH_USDT_CONTRACT, data }, "latest"],
  });
  for (const url of ETH_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: request,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const frozen = bool((JSON.parse(text) as { result?: unknown }).result);
      if (frozen !== null) return { frozen, hash: sha256(request, text) };
    } catch {
      // The next node.
    }
  }
  return null;
}

async function readTron(address: string): Promise<{ frozen: boolean; hash: string } | null> {
  const bytes = base58Decode(address);
  if (!bytes || bytes.length !== 25) return null;
  const hex20 = Array.from(bytes.subarray(1, 21), (b) => b.toString(16).padStart(2, "0")).join("");
  const request = JSON.stringify({
    owner_address: USDT_CONTRACT,
    contract_address: USDT_CONTRACT,
    function_selector: "isBlackListed(address)",
    parameter: hex20.padStart(64, "0"),
    visible: true,
  });
  try {
    const res = await fetch("https://api.trongrid.io/wallet/triggerconstantcontract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {}),
      },
      body: request,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const body = JSON.parse(text) as {
      result?: { result?: boolean };
      constant_result?: unknown[];
    };
    if (body.result?.result !== true) return null;
    const frozen = bool(body.constant_result?.[0]);
    return frozen === null ? null : { frozen, hash: sha256(request, text) };
  } catch {
    return null;
  }
}

export async function issuerFreezeStatus(raw: string): Promise<IssuerStatus> {
  const check = checkAddress(raw);
  if (!check.valid) {
    return { status: "unchecked", chain: check.chain, address: raw.trim(), reason: check.reason };
  }
  const read =
    check.chain === "ethereum" ? await readEthereum(check.address) : await readTron(check.address);
  if (!read) {
    return {
      status: "unchecked",
      chain: check.chain,
      address: check.address,
      reason: "The chain did not answer, so nothing is stated about whether the issuer has frozen this address.",
    };
  }
  return {
    status: read.frozen ? "frozen" : "not-frozen",
    chain: check.chain,
    address: check.address,
    checkedAt: new Date().toISOString(),
    responseHash: read.hash,
  };
}
