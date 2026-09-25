/**
 * Attribution lookup. AGENTS.md §9.
 *
 * One Map built once at module load from the three data files. Every screen and
 * every route asks this and nothing else, so there is exactly one place that
 * decides what an address is.
 *
 * Two rules matter more than the code:
 *
 *  1. **Priority.** An address can appear in more than one list, and the answer
 *     must be deterministic:
 *
 *         sanctioned > exchange hot wallet > exchange deposit address > community
 *
 *     A sanctioned address that also happens to be an exchange wallet is
 *     reported as sanctioned. Understating a sanctions hit is the worse error.
 *
 *  2. **Source honesty.** An explorer tag is `ground_truth`. A sweep-pattern
 *     match is `heuristic`. An OFAC listing is `sanctions`. The interface shows
 *     this tier, and showing our uncertainty is the point — a label that claims
 *     more than it can support is worse than no label.
 */

// Relative, not aliased: this module is exercised directly by node as well as
// by Next, and the "@/" alias only resolves inside the bundler.
import depositAddresses from "../data/deposit-addresses.json";
import ethConsolidation from "../data/eth/consolidation-wallets.json";
import ethCalibration from "../data/eth/clustering-calibration.json";
import ethDeposits from "../data/eth/deposit-addresses.json";
import ethHotWallets from "../data/eth/hot-wallets.json";
import hotWallets from "../data/hot-wallets.json";
import riskLists from "../data/risk-lists.json";
import multichain from "../data/sanctions-multichain.json";
import type { Label } from "./types";

type HotWallet = { address: string; exchange: string; tag?: string; source_url?: string };
type DepositRow = {
  address: string;
  exchange: string;
  sweepCount: number;
  confidence: number;
  evidence?: string;
};
type Sanctioned = {
  address: string;
  list: string;
  entity?: string;
  program?: string;
  /** The asset OFAC filed it under. Usually TRX; a designation naming the token files it under USDT. */
  asset?: string;
};
type Mixer = { address: string; name?: string };
type Community = { address: string; reports?: number; source?: string };
type EthSeed = {
  address: string;
  exchange: string;
  /** Set when the wallet is this exchange's own account at another exchange (a customer deposit address there). */
  heldAt?: string;
  tag: string;
  /** "deposit_funder": the exchange's gas wallet for customer deposit addresses. */
  role?: string;
};
type EthDerived = { address: string; exchange: string; confidence: number; evidence?: string };
type MultichainRow = { address: string; assets?: string[]; entity?: string; program?: string };

const EVM = /^0x[0-9a-fA-F]{40}$/;
/**
 * The key an address is stored and looked up under. An Ethereum address is
 * case-insensitive on the chain, so its key is lower case: two spellings of one
 * wallet are one label. A TRON address is case-sensitive and kept exactly.
 */
const keyOf = (address: string): string => {
  const a = address.trim();
  return EVM.test(a) ? a.toLowerCase() : a;
};

const LABELS = new Map<string, Label>();

/* Built in reverse priority order, so each tier overwrites the one below it. */

// 4 — community reports, the weakest tier.
for (const row of (riskLists.community ?? []) as Community[]) {
  if (!row?.address) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.source ? `Reported on ${row.source}` : "Community-reported address",
    kind: "unknown",
    confidence: 0.3,
    source: "community",
    evidence: row.reports ? `${row.reports} abuse reports` : undefined,
  });
}

// Derived rows the independent gas-payer check contradicts
// (scripts/calibrate-clustering-eth.mjs): their gas was paid by another
// entity's gas or custody wallet, so someone else may manage the address. The
// row stays — its sweeps are real — but its evidence says so, and the packet
// and freeze request print evidence, so the doubt travels with the name.
const GAS_CONFLICT = new Map(
  (
    (ethCalibration as { gasPayer?: { conflicting?: Array<{ address: string; tags?: string }> } })
      .gasPayer?.conflicting ?? []
  ).map((c) => [keyOf(c.address), c.tags ?? "another entity's wallet"] as const),
);

// 3 — deposit addresses we derived ourselves. Heuristic, and labelled as such.
for (const row of [...(depositAddresses as DepositRow[]), ...(ethDeposits as EthDerived[])]) {
  if (!row?.address) continue;
  const conflict = GAS_CONFLICT.get(keyOf(row.address));
  LABELS.set(keyOf(row.address), {
    entity: row.exchange,
    kind: "exchange_deposit",
    confidence: row.confidence,
    source: "heuristic",
    evidence: conflict
      ? `${row.evidence}. Caution: its gas was paid by "${conflict.split(" / ")[0]}", not by ${row.exchange} — another party may manage this address`
      : row.evidence,
  });
}

// 2b — Ethereum only: a wallet that the deposit addresses an exchange's own
// tagged gas wallet funds all sweep into. Derived, so heuristic, and outranked
// by any explorer tag on the same address below.
for (const row of ethConsolidation as EthDerived[]) {
  if (!row?.address) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.exchange,
    kind: "exchange_hot",
    confidence: row.confidence,
    source: "heuristic",
    evidence: row.evidence,
  });
}

// 2 — exchange wallets carrying a public explorer tag, on either chain.
for (const row of ethHotWallets as EthSeed[]) {
  if (!row?.address) continue;
  LABELS.set(
    keyOf(row.address),
    row.heldAt
      ? // One exchange's own account at another: a customer deposit address at
        // the exchange that holds it, labelled as that, with its holder named.
        {
          entity: row.heldAt,
          kind: "exchange_deposit",
          confidence: 1,
          source: "ground_truth",
          evidence: `Explorer-tagged "${row.tag}": ${row.exchange}'s own account at ${row.heldAt}`,
        }
      : {
          entity: row.exchange,
          kind: "exchange_hot",
          confidence: 1,
          source: "ground_truth",
          evidence: `Explorer-tagged "${row.tag}"${row.role === "deposit_funder" ? " (gas wallet for customer deposit addresses)" : ""}`,
        },
  );
}
for (const row of hotWallets as HotWallet[]) {
  if (!row?.address) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.exchange,
    kind: "exchange_hot",
    confidence: 1,
    source: "ground_truth",
    evidence: row.tag ? `Explorer-tagged "${row.tag}"` : undefined,
  });
}

// 1 — mixing services. Empty today, and deliberately so: see data/risk-lists.json.
for (const row of (riskLists.mixers ?? []) as Mixer[]) {
  if (!row?.address) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.name ?? "Mixing service",
    kind: "mixer",
    confidence: 0.9,
    source: "community",
    evidence: "Listed as a mixing service in data/risk-lists.json",
  });
}

// 0 — sanctions outrank everything.
// Ethereum-format addresses on the same OFAC list, whatever asset OFAC filed
// them under — the address is the same account on Ethereum either way.
for (const row of ((multichain as { addresses?: MultichainRow[] }).addresses ?? [])) {
  if (!row?.address || !EVM.test(row.address)) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.entity ?? "Sanctioned entity",
    kind: "sanctioned",
    confidence: 1,
    source: "sanctions",
    evidence:
      ["OFAC SDN", row.program, row.assets?.length ? `filed under ${row.assets.join(", ")}` : null]
        .filter(Boolean)
        .join(" · "),
  });
}
for (const row of (riskLists.sanctioned ?? []) as Sanctioned[]) {
  if (!row?.address) continue;
  LABELS.set(keyOf(row.address), {
    entity: row.entity ?? "Sanctioned entity",
    kind: "sanctioned",
    confidence: 1,
    source: "sanctions",
    evidence:
      [row.list, row.program, row.asset && row.asset !== "TRX" ? `filed under ${row.asset}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
  });
}

/** The only way to ask what an address is. */
export function lookup(address: string): Label | null {
  return LABELS.get(keyOf(address)) ?? null;
}

/** True when a trace should stop expanding here — we have our answer. */
export function isTerminal(label: Label | null): boolean {
  if (!label) return false;
  return (
    label.kind === "exchange_deposit" ||
    label.kind === "exchange_hot" ||
    label.kind === "mixer" ||
    label.kind === "sanctioned" ||
    label.kind === "contract"
  );
}

/** For the operations page and the slide: what the table actually holds. */
export function labelStats(chain?: "tron" | "ethereum") {
  const rows = [...LABELS.entries()]
    .filter(([key]) => !chain || (chain === "ethereum") === key.startsWith("0x"))
    .map(([, label]) => label);
  let hot = 0;
  let deposit = 0;
  let sanctioned = 0;
  let mixer = 0;
  for (const label of rows) {
    if (label.kind === "exchange_hot") hot++;
    else if (label.kind === "exchange_deposit") deposit++;
    else if (label.kind === "sanctioned") sanctioned++;
    else if (label.kind === "mixer") mixer++;
  }
  const exchanges = new Set(
    rows
      .filter((l) => l.kind === "exchange_deposit" || l.kind === "exchange_hot")
      .map((l) => l.entity),
  );
  return { total: rows.length, hot, deposit, sanctioned, mixer, exchanges: exchanges.size };
}
