/**
 * Which of this morning's complaints are the same case.
 *
 * Triage answers "where is the next hour worth spending". It does not answer
 * the question a cyber cell asks immediately afterwards: *are any of these the
 * same people*. Fourteen complaints from nine states that converge on one
 * wallet are not fourteen cases — they are one network, and that is the form in
 * which this kind of fraud actually gets prosecuted.
 *
 * Nothing new is read from the chain. Every traced result already carries the
 * wallets it passed through; a link is simply the same wallet appearing in more
 * than one of them.
 *
 * **What is deliberately not a link.** Two cases both ending at Binance is not
 * a connection between them, it is a fact about Binance — and the same goes for
 * a mixer or a sanctioned service, which are shared by everyone who uses them.
 * Linking on those would put almost every pair of cases together and the
 * feature would mean nothing. So shared *infrastructure* is excluded and shared
 * *accounts* are kept: an unlabelled intermediary both victims' money ran
 * through, or one customer deposit address inside an exchange, which is the
 * strongest link of all because it is one accountholder.
 */

import type { Label, TraceResult } from "./types";

/** Labels that describe a service everyone shares, not an account. */
const SHARED_INFRASTRUCTURE = new Set(["exchange_hot", "mixer", "sanctioned"]);

export interface LinkedCase {
  caseId: string;
  inputAddress: string;
  /** How much of that case's money reached the shared wallet. */
  taintedValueUsdt: number;
}

export interface CaseLink {
  /** The wallet that more than one complaint ran through. */
  address: string;
  label: Label | null;
  cases: LinkedCase[];
  /** Victim money from all linked cases that reached this wallet. */
  totalUsdt: number;
}

export function findLinks(traces: TraceResult[]): CaseLink[] {
  const byAddress = new Map<string, { label: Label | null; cases: Map<string, LinkedCase> }>();

  for (const trace of traces) {
    for (const node of trace.nodes) {
      if (node.label && SHARED_INFRASTRUCTURE.has(node.label.kind)) continue;

      const row =
        byAddress.get(node.address) ?? { label: node.label, cases: new Map<string, LinkedCase>() };
      // A label found in one trace still describes the wallet in the others.
      if (!row.label && node.label) row.label = node.label;
      // One entry per case, keeping the larger share if a wallet is reached twice.
      const existing = row.cases.get(trace.inputAddress);
      if (!existing || node.taintedValueUsdt > existing.taintedValueUsdt) {
        row.cases.set(trace.inputAddress, {
          caseId: trace.caseId,
          inputAddress: trace.inputAddress,
          taintedValueUsdt: node.taintedValueUsdt,
        });
      }
      byAddress.set(node.address, row);
    }
  }

  const links: CaseLink[] = [];
  for (const [address, row] of byAddress) {
    if (row.cases.size < 2) continue;
    const cases = [...row.cases.values()].sort(
      (a, b) => b.taintedValueUsdt - a.taintedValueUsdt,
    );
    links.push({
      address,
      label: row.label,
      cases,
      totalUsdt: cases.reduce((sum, c) => sum + c.taintedValueUsdt, 0),
    });
  }

  // Most complaints first — that is the one worth opening — then most money.
  return links.sort(
    (a, b) => b.cases.length - a.cases.length || b.totalUsdt - a.totalUsdt,
  );
}
