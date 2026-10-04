/**
 * Where a register row came from, in the words every screen uses. The live
 * register (lib/register.ts) mixes reads of different ages, so each list says
 * which a row is: one map, so the Queue, the Evidence list and the case rail
 * can never word it differently. Client-safe: no I/O.
 */
import type { CaseSummary } from "./types";

export const ORIGIN: Record<string, { label: string; title: string }> = {
  reference: {
    label: "Re-read live",
    title: "A recorded wallet, traced again live by this server on its own schedule",
  },
  traced: { label: "Traced here", title: "Traced on this server" },
  saved: { label: "Saved", title: "Saved to the shared case file" },
  recorded: {
    label: "Recorded",
    title: "Captured from the chain when the case was recorded; the live re-read has not reached it yet",
  },
};

export type RowExtras = { origin?: string; readAt?: string; by?: string | null; chain?: string };

/** The register's extra fields on a row, when the row came from the live register. */
export const extras = (c: CaseSummary) => c as CaseSummary & RowExtras;

/** The label, the tooltip and whether the row is only a recorded stand-in. */
export function originOf(
  c: CaseSummary,
  readAtText: (iso: string) => string,
): { label: string; title: string; recorded: boolean } | null {
  const e = extras(c);
  const o = e.origin ? ORIGIN[e.origin] : undefined;
  if (!o) return null;
  return {
    label: o.label,
    title: [o.title, e.readAt ? `read ${readAtText(e.readAt)}` : null, e.by].filter(Boolean).join(" · "),
    recorded: e.origin === "recorded",
  };
}
