/**
 * Sanctions screening for an address on any chain OFAC lists.
 *
 * The tracer follows USDT on TRON and nothing else. Screening is the part of
 * "support multiple blockchain ecosystems" that can be done honestly today on
 * every chain at once: an exact match against the OFAC SDN list's digital-
 * currency addresses, with no chain read and no heuristic. It answers the
 * question an officer holding a non-TRON address asks first — is this a
 * designated party — and it is the same answer on any day the file is the same.
 *
 * One rule governs the wording: **listed is a finding, not listed is not a
 * clearance.** OFAC lists a small fraction of the addresses any designated
 * party controls, so "not on the list" says nothing about the address; the
 * route and the screen both say so rather than letting silence read as clean.
 *
 * TRON addresses are answered from `lib/labels.ts`, the one table the tracer
 * reads, so a TRON address can never screen differently from how a trace
 * labels it.
 */

import multichain from "../data/sanctions-multichain.json";
import riskLists from "../data/risk-lists.json";
import { identifyChain, type ChainInfo } from "./chains";
import { lookup } from "./labels";

export interface Listing {
  list: "OFAC SDN";
  entity: string;
  program: string | null;
  /** The asset(s) OFAC filed this address under, e.g. ["ETH"] or ["XBT", "USDT"]. */
  assets: string[];
}

export interface Screening {
  address: string;
  /** null when the string is not a format FineX recognises; it is still screened. */
  chain: ChainInfo | null;
  /** True when a checksum in the address was verified. */
  checksumVerified: boolean;
  listing: Listing | null;
  list: {
    name: "OFAC Specially Designated Nationals list";
    published: string | null;
    /** Addresses screened against for this answer: all chains, TRON included. */
    addresses: number;
    assets: number;
  };
}

type MultiRow = { address: string; assets: string[]; entity: string; program?: string };
type TronRow = { address: string; entity?: string; program?: string; asset?: string };

/** EVM hex is case-insensitive; everything else is matched exactly as written. */
const keyOf = (address: string) =>
  /^0x[0-9a-f]{40}$/i.test(address) ? address.toLowerCase() : address;

const OTHER = new Map<string, MultiRow>();
for (const row of multichain.addresses as MultiRow[]) OTHER.set(keyOf(row.address), row);

const TRON_ROWS = new Map<string, TronRow>();
for (const row of riskLists.sanctioned as TronRow[]) TRON_ROWS.set(row.address, row);

const ASSETS = new Set<string>(Object.keys(multichain.assets));
for (const row of TRON_ROWS.values()) {
  for (const a of (row.asset ?? "TRX").split(",")) ASSETS.add(a.trim());
}

/** What the screening covers, for any screen that states it. */
export const SCREENING_COVERAGE = {
  published: (multichain as { _published?: string | null })._published ?? null,
  addresses: OTHER.size + TRON_ROWS.size,
  assets: ASSETS.size,
  tron: TRON_ROWS.size,
  otherChains: OTHER.size,
};

export function screenAddress(raw: string): Screening {
  const address = raw.trim();
  const guess = identifyChain(address);

  let listing: Listing | null = null;
  const tron = guess?.chain.id === "tron" ? TRON_ROWS.get(address) : undefined;
  if (tron && lookup(address)?.kind === "sanctioned") {
    listing = {
      list: "OFAC SDN",
      entity: tron.entity ?? "Sanctioned entity",
      program: tron.program ?? null,
      assets: (tron.asset ?? "TRX").split(",").map((a) => a.trim()),
    };
  } else {
    const row = OTHER.get(keyOf(address));
    if (row) {
      listing = {
        list: "OFAC SDN",
        entity: row.entity,
        program: row.program ?? null,
        assets: row.assets,
      };
    }
  }

  return {
    address,
    chain: guess?.chain ?? null,
    checksumVerified: guess?.verified ?? false,
    listing,
    list: {
      name: "OFAC Specially Designated Nationals list",
      published: SCREENING_COVERAGE.published,
      addresses: SCREENING_COVERAGE.addresses,
      assets: SCREENING_COVERAGE.assets,
    },
  };
}
