/**
 * Where the chain is read from — and so who learns which wallets are being
 * investigated.
 *
 * Every read FineX makes names a wallet an officer is looking at. Against the
 * public endpoints that is a record, held by a third party, of which addresses
 * are under investigation and when. A deployment can instead point each kind
 * of read at infrastructure it runs itself, one setting each:
 *
 *   TRONGRID_URL    TRON wallet histories and transaction lookups: an API
 *                   serving TronGrid's /v1/accounts/{a}/transactions/trc20 and
 *                   /v1/transactions/{id}/events
 *   TRON_NODE_URL   the Tether freeze check on TRON: a full node's HTTP API
 *                   (/wallet/triggerconstantcontract), as java-tron serves it
 *   BLOCKSCOUT_URL  every Ethereum history read: a Blockscout instance's API v2
 *                   base (ending /api/v2); Blockscout is open source
 *   ETH_RPC_URL     the Tether freeze check on Ethereum: any JSON-RPC node
 *
 * Three rules, all for the same reason — a silent fallback would send the very
 * wallet a setting exists to keep in-house:
 *
 *  - **A setting that is given is used alone.** When the agency's node is down,
 *    those reads fail and say so; they never go to a public endpoint instead.
 *    A setting that is not an http(s) URL fails the same way.
 *  - **A chain read in-house stays in-house.** With TRONGRID_URL set, the TRON
 *    freeze check uses TRON_NODE_URL or, failing that, the same host (TronGrid
 *    serves both APIs); with BLOCKSCOUT_URL set, the Ethereum freeze check uses
 *    ETH_RPC_URL or is not made.
 *  - **A key goes only to the service it belongs to.** TRONGRID_API_KEY and
 *    BLOCKSCOUT_API_KEY are never sent to an agency's own endpoint.
 *
 * `/api/health` says, for each kind of read, "own", "public", "invalid" or
 * "none" (not made) — never the address itself.
 *
 * Server-only.
 */

export type Source = "own" | "public" | "invalid" | "none";

export interface Endpoint {
  /** Base URL without a trailing slash; null when the read cannot be made. */
  base: string | null;
  source: Source;
}

export const PUBLIC = {
  tron: "https://api.trongrid.io",
  ethereum: "https://eth.blockscout.com/api/v2",
  /** Blockscout's Pro API, which a key requires. */
  ethereumKeyed: "https://api.blockscout.com/1/api/v2",
  rpcs: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://cloudflare-eth.com",
    "https://1rpc.io/eth",
  ],
} as const;

const given = (name: string): string | null => process.env[name]?.trim() || null;

function own(name: string): Endpoint {
  const raw = given(name) ?? "";
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { base: raw.replace(/\/+$/, ""), source: "own" };
    }
  } catch {
    // Not a URL: refused below.
  }
  return { base: null, source: "invalid" };
}

export function tronHistory(): Endpoint {
  return given("TRONGRID_URL") ? own("TRONGRID_URL") : { base: PUBLIC.tron, source: "public" };
}

export function tronNode(): Endpoint {
  if (given("TRON_NODE_URL")) return own("TRON_NODE_URL");
  const history = tronHistory();
  return history.source === "public" ? { base: PUBLIC.tron, source: "public" } : history;
}

export function ethHistory(): Endpoint {
  if (given("BLOCKSCOUT_URL")) return own("BLOCKSCOUT_URL");
  return { base: given("BLOCKSCOUT_API_KEY") ? PUBLIC.ethereumKeyed : PUBLIC.ethereum, source: "public" };
}

export function ethNodes(): { bases: string[]; source: Source } {
  if (given("ETH_RPC_URL")) {
    const e = own("ETH_RPC_URL");
    return { bases: e.base ? [e.base] : [], source: e.source };
  }
  if (ethHistory().source !== "public") return { bases: [], source: "none" };
  return { bases: [...PUBLIC.rpcs], source: "public" };
}

/** TronGrid's key, only for a read that goes to TronGrid itself. */
export function tronKey(endpoint: Endpoint): string | null {
  return endpoint.source === "public" ? given("TRONGRID_API_KEY") : null;
}

/** Blockscout's key, only for the public Pro API. */
export function blockscoutKey(): string | null {
  return ethHistory().source === "public" ? given("BLOCKSCOUT_API_KEY") : null;
}

/**
 * Why a wallet's history could not be read, for the sentence an officer sees.
 * Blaming a public endpoint's rate limit is only true when the read went there.
 */
export function unreadCause(chain: "tron" | "ethereum"): string {
  const endpoint = chain === "ethereum" ? ethHistory() : tronHistory();
  const setting = chain === "ethereum" ? "BLOCKSCOUT_URL" : "TRONGRID_URL";
  if (endpoint.source === "invalid") return `${setting} is set but is not an http(s) URL`;
  if (endpoint.source === "own") return "this deployment's own endpoint did not answer";
  return "the public endpoint is rate-limiting this deployment";
}

/** What `/api/health` reports: where each kind of read goes, never the address. */
export function readSources(): Record<"tronHistory" | "tronNode" | "ethHistory" | "ethNode", Source> {
  return {
    tronHistory: tronHistory().source,
    tronNode: tronNode().source,
    ethHistory: ethHistory().source,
    ethNode: ethNodes().source,
  };
}
