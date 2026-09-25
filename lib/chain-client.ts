/**
 * What the tracer needs from a chain, and nothing more.
 *
 * One engine traces both chains; each chain supplies a client with these
 * members. The rules the tracer relies on hold for every client:
 *
 *  - `transfers` is USDT only, newest first, capped, cached per trace.
 *  - A wallet the chain did not answer for is `didFail`, never an empty list.
 *  - A wallet read only in part is `wasTruncated`, never a whole one.
 *  - Every response body is SHA-256 hashed and every request counted.
 */

export type ChainName = "tron" | "ethereum";

export interface Transfer {
  txHash: string;
  from: string;
  to: string;
  /** Already divided down by the token's decimals. */
  value: number;
  timestamp: number;
  symbol: string;
  /** Ethereum: the block it is in, so a later read can seek straight to it. */
  block?: number;
}

/** What an explorer says about an address, gathered from rows already read. */
export interface ContractInfo {
  isContract: boolean;
  /** Verified source name, e.g. "UniversalRouter". */
  name: string | null;
  /** e.g. "eip1967", "eip1167", "eip7702". */
  proxyType: string | null;
  /** Explorer tag names, most specific first, e.g. "Polygon (Matic): ERC20 Bridge". */
  tags: string[];
}

export interface ChainClient {
  readonly chain: ChainName;
  readonly apiCalls: number;
  readonly responseHashes: string[];
  transfers(address: string): Promise<Transfer[]>;
  outflowsSince(
    address: string,
    sinceMs: number,
  ): Promise<{ transfers: Transfer[]; complete: boolean } | null>;
  didFail(address: string): boolean;
  wasTruncated(address: string): boolean;
  /**
   * Ethereum only. Answered from transfer rows already read — the row that
   * brought money to an address describes that address — so it never costs a
   * request. Null when nothing has been seen about the address.
   */
  contractInfo?(address: string): ContractInfo | null;
}
