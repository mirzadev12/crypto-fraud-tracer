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
import hotWallets from "../data/hot-wallets.json";
import riskLists from "../data/risk-lists.json";
import type { Label } from "./types";

type HotWallet = { address: string; exchange: string; tag?: string; source_url?: string };
type DepositRow = {
  address: string;
  exchange: string;
  sweepCount: number;
  confidence: number;
  evidence?: string;
};
type Sanctioned = { address: string; list: string; entity?: string; program?: string };
type Mixer = { address: string; name?: string };
type Community = { address: string; reports?: number; source?: string };

const LABELS = new Map<string, Label>();

/* Built in reverse priority order, so each tier overwrites the one below it. */

// 4 — community reports, the weakest tier.
for (const row of (riskLists.community ?? []) as Community[]) {
  if (!row?.address) continue;
  LABELS.set(row.address, {
    entity: row.source ? `Reported on ${row.source}` : "Community-reported address",
    kind: "unknown",
    confidence: 0.3,
    source: "community",
    evidence: row.reports ? `${row.reports} abuse reports` : undefined,
  });
}

// 3 — deposit addresses we derived ourselves. Heuristic, and labelled as such.
for (const row of depositAddresses as DepositRow[]) {
  if (!row?.address) continue;
  LABELS.set(row.address, {
    entity: row.exchange,
    kind: "exchange_deposit",
    confidence: row.confidence,
    source: "heuristic",
    evidence: row.evidence,
  });
}

// 2 — exchange hot wallets carrying a public explorer tag.
for (const row of hotWallets as HotWallet[]) {
  if (!row?.address) continue;
  LABELS.set(row.address, {
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
  LABELS.set(row.address, {
    entity: row.name ?? "Mixing service",
    kind: "mixer",
    confidence: 0.9,
    source: "community",
    evidence: "Listed as a mixing service in data/risk-lists.json",
  });
}

// 0 — sanctions outrank everything.
for (const row of (riskLists.sanctioned ?? []) as Sanctioned[]) {
  if (!row?.address) continue;
  LABELS.set(row.address, {
    entity: row.entity ?? "Sanctioned entity",
    kind: "sanctioned",
    confidence: 1,
    source: "sanctions",
    evidence: [row.list, row.program].filter(Boolean).join(" · ") || undefined,
  });
}

/** The only way to ask what an address is. */
export function lookup(address: string): Label | null {
  return LABELS.get(address.trim()) ?? null;
}

/** True when a trace should stop expanding here — we have our answer. */
export function isTerminal(label: Label | null): boolean {
  if (!label) return false;
  return (
    label.kind === "exchange_deposit" ||
    label.kind === "exchange_hot" ||
    label.kind === "mixer" ||
    label.kind === "sanctioned"
  );
}

/** For the operations page and the slide: what the table actually holds. */
export function labelStats() {
  let hot = 0;
  let deposit = 0;
  let sanctioned = 0;
  let mixer = 0;
  for (const label of LABELS.values()) {
    if (label.kind === "exchange_hot") hot++;
    else if (label.kind === "exchange_deposit") deposit++;
    else if (label.kind === "sanctioned") sanctioned++;
    else if (label.kind === "mixer") mixer++;
  }
  const exchanges = new Set(
    [...LABELS.values()]
      .filter((l) => l.kind === "exchange_deposit" || l.kind === "exchange_hot")
      .map((l) => l.entity),
  );
  return { total: LABELS.size, hot, deposit, sanctioned, mixer, exchanges: exchanges.size };
}
