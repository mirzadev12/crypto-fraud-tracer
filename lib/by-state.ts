/**
 * A batch of complaints, counted by state or union territory — the view I4C
 * coordinates in: which states' complaints still have money that can be
 * reached, and which exchanges it reached. Counted from the traced results of
 * one batch and nothing else; a complaint whose wallet could not be read is
 * counted as not read, never as empty.
 */

import type { TraceResult } from "./types";

/** Where a complaint without a state is filed. */
export const NO_STATE = "State not given";

export interface StateRow {
  stateUt: string;
  complaints: number;
  /** CRITICAL: money still held where it was found. */
  critical: number;
  /** SUSPICIOUS: the money reached an exchange or service. */
  reachedExchange: number;
  /** CLOSED: a mixer or sanctioned address; nothing left to act on. */
  closed: number;
  /** Traces that could not be read. */
  notRead: number;
  /** USDT traced in the complaints still worth acting on (critical and suspicious). */
  reachableUsdt: number;
  /** Exchanges the money reached, most complaints first. */
  exchanges: Array<{ entity: string; complaints: number }>;
}

export interface StateInput {
  stateUt?: string;
  trace?: TraceResult;
  failed?: boolean;
}

export function byState(items: StateInput[]): StateRow[] {
  const groups = new Map<string, StateInput[]>();
  for (const item of items) {
    const k = item.stateUt?.trim() || NO_STATE;
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([stateUt, list]) => {
      const traced = list.filter((i) => i.trace).map((i) => i.trace as TraceResult);
      const exchanges = new Map<string, number>();
      for (const t of traced) {
        const kind = t.terminal?.label.kind;
        if (kind === "exchange_deposit" || kind === "exchange_hot") {
          const entity = t.terminal!.label.entity;
          exchanges.set(entity, (exchanges.get(entity) ?? 0) + 1);
        }
      }
      return {
        stateUt,
        complaints: list.length,
        critical: traced.filter((t) => t.triage === "HOT").length,
        reachedExchange: traced.filter((t) => t.triage === "WARM").length,
        closed: traced.filter((t) => t.triage === "COLD").length,
        notRead: list.filter((i) => i.failed).length,
        reachableUsdt: traced.filter((t) => t.triage !== "COLD").reduce((s, t) => s + t.reportedAmountUsdt, 0),
        exchanges: [...exchanges.entries()]
          .map(([entity, complaints]) => ({ entity, complaints }))
          .sort((a, b) => b.complaints - a.complaints || a.entity.localeCompare(b.entity)),
      };
    })
    .sort(
      (a, b) =>
        Number(a.stateUt === NO_STATE) - Number(b.stateUt === NO_STATE) ||
        b.reachableUsdt - a.reachableUsdt ||
        b.complaints - a.complaints,
    );
}
