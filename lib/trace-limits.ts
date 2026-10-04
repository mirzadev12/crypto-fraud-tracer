/**
 * The tracer's search limits (AGENTS.md §9), in one place so the screens that
 * state them — the court-preparation sheet, the packet's limitations — quote
 * the numbers the tracer actually uses rather than a copy that can drift.
 */
/** Hops followed from the reported address. */
export const MAX_DEPTH = 3;
/** Outflows followed per wallet, largest first. */
export const TOP_OUTFLOWS = 5;
/** Transfers below this share of the reported amount are not followed. */
export const DUST_FRACTION = 0.01;
