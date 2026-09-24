/**
 * Where USDT on Ethereum stops being traceable as USDT.
 *
 * Money that enters a DEX pool is swapped or pooled with everyone else's; money
 * that enters a bridge leaves Ethereum. Following such a contract's outflows
 * would follow other people's money — a pool pays out to unrelated swappers —
 * and could name one of them as the exit. So the trace stops at a contract and
 * says what it is, from the explorer's own tags, or says it could not tell.
 *
 * Smart-contract *wallets* are the exception: a Safe multisig or an EIP-7702
 * account holds its owner's money like any wallet, and is followed as one.
 */

import type { ContractInfo } from "./chain-client";
import type { Label } from "./types";

/** Verified names of wallet proxies that are followed, not stopped at. */
const WALLET_PROXIES = new Set(["GnosisSafeProxy", "SafeProxy"]);

export type ContractCategory = "bridge" | "defi" | "other";

/** A contract a trace should stop at — false for EOAs and contract wallets. */
export function stopsTrace(info: ContractInfo | null | undefined): boolean {
  if (!info || !info.isContract) return false;
  if (info.proxyType === "eip7702") return false;
  if (info.name && WALLET_PROXIES.has(info.name)) return false;
  return true;
}

export function categorize(info: ContractInfo): ContractCategory {
  const tags = info.tags.join(" · ");
  if (/\bbridge\b/i.test(tags)) return "bridge";
  if (/\b(dex|router|pool|swap|amm|aggregator|lending)\b/i.test(tags)) return "defi";
  return "other";
}

/**
 * The label a stopped contract carries. Its source is the explorer's own record
 * — that the address holds code is a fact of the chain, and the name is the
 * explorer's tag, quoted — so it is `ground_truth` about *what the address is*,
 * and claims nothing about who controls it.
 */
export function contractLabel(info: ContractInfo): Label {
  const category = categorize(info);
  const named = info.tags[0] ?? null;
  const entity = named ?? "Unlabelled smart contract";
  const evidence = [
    named ? `Explorer-tagged "${info.tags.slice(0, 3).join(" / ")}"` : "Has contract code; no explorer tag",
    info.name ? `verified as ${info.name}` : null,
    category === "bridge" ? "cross-chain bridge" : category === "defi" ? "DeFi contract" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { entity, kind: "contract", confidence: 1, source: "ground_truth", evidence };
}

/** The category a stopped contract's label was built from, read back from it. */
export function categoryOf(label: Label): ContractCategory {
  const e = label.evidence ?? "";
  if (e.includes("cross-chain bridge")) return "bridge";
  if (e.includes("DeFi contract")) return "defi";
  return "other";
}
