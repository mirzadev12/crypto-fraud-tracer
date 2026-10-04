"use client";

import { accessFor, useDeskAccess, type DeskAccess } from "@/lib/desk-access";
import { andList } from "@/lib/format";
import { leContact, needsAccess } from "@/lib/le-contacts";

/**
 * Can this desk reach the exchanges a batch found? The same reading the
 * sending guide gives one exchange (components/SendingGuide.tsx), across the
 * morning's list, so an exchange whose portal the desk was never registered on
 * shows up while there is still time to apply, not when the letter is ready.
 */

type Readiness = { tone: string; text: string };

function readinessOf(exchange: string, all: DeskAccess): Readiness {
  const contact = leContact(exchange);
  if (!contact || !contact.found) return { tone: "text-faint", text: "No channel recorded" };
  if (!needsAccess(contact)) return { tone: "text-muted", text: "No account needed" };
  const access = accessFor(all, exchange);
  if (access?.state === "active") return { tone: "text-confirmed", text: "Ready" };
  if (access?.state === "applied") return { tone: "text-suspicious", text: "Access applied for" };
  return { tone: "text-critical", text: "No portal access recorded" };
}

/** One exchange's readiness, as a short tag for a row. */
export function ReadinessTag({ exchange }: { exchange: string }) {
  const r = readinessOf(exchange, useDeskAccess());
  return <span className={`font-label text-[10px] uppercase tracking-[0.16em] ${r.tone}`}>{r.text}</span>;
}

/** The exchanges in a batch this desk cannot yet send to through their portal. */
export function ReadinessSummary({ exchanges }: { exchanges: string[] }) {
  const all = useDeskAccess();
  const blocked = [...new Set(exchanges)].filter((e) => {
    const contact = leContact(e);
    return needsAccess(contact) && accessFor(all, e)?.state !== "active";
  });
  if (!blocked.length) return null;
  const named = blocked.map((e) => {
    const contact = leContact(e);
    const lead = contact && contact.found ? contact.leadTime : undefined;
    return lead ? `${e} (approval generally ${lead})` : e;
  });
  return (
    <p className="mb-4 border-l-2 border-critical-deep py-1 pl-4 text-sm leading-6 text-muted">
      <span className="text-ink">
        {blocked.length === 1 ? "One exchange" : `${blocked.length} exchanges`} in this batch take requests
        through a portal this desk has no active access to:
      </span>{" "}
      {andList(named)}. Apply now, or record the access on its request page; it is kept in this browser.
    </p>
  );
}
