/**
 * Is the exchange a trace ended at registered in India? The one line an Indian
 * officer can act on without a treaty request: a VDA service provider registered
 * with FIU-IND is a reporting entity under the PMLA, operated by a named legal
 * entity a notice can be addressed to.
 *
 * FIU-IND does not publish its register. The government document that names
 * registered providers is the Ministry of Finance's answer to Lok Sabha
 * Unstarred Question 112 of 4 December 2023, and `data/fiu-ind.json` copies its
 * annexure exactly. Two rules follow from that:
 *
 *  - The line always carries its source and date. It is a December 2023 fact.
 *  - Absence proves nothing. An exchange that is not in the annexure may have
 *    registered since, so no screen ever says "not registered" — it says nothing.
 *
 * What registration obliges an exchange to do is not claimed anywhere.
 */

import fiu from "../data/fiu-ind.json";

export interface FiuListing {
  legalName: string;
  tradeName: string;
}

export const FIU_SOURCE = {
  title: "Lok Sabha Unstarred Question 112",
  answered: fiu._answered,
  url: fiu._url,
  /** "4 December 2023" */
  date: "4 December 2023",
};

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const BY_NAME = new Map<string, FiuListing>();
for (const row of fiu.entities) {
  if (!row.tradeName) continue;
  const k = key(row.tradeName);
  // Two rows share the "Rario" trade name; the first, the Indian company, is kept.
  if (!BY_NAME.has(k)) BY_NAME.set(k, { legalName: row.legalName, tradeName: row.tradeName });
}

/** The annexure row for an exchange, or null — which means nothing either way. */
export function fiuListing(exchange: string | null | undefined): FiuListing | null {
  if (!exchange) return null;
  return BY_NAME.get(key(exchange)) ?? null;
}

/** The sentence every screen prints, so the wording cannot drift between them. */
export function fiuSentence(exchange: string, listing: FiuListing): string {
  return (
    `${exchange} is operated by ${listing.legalName}, listed as registered with FIU-IND ` +
    `in the Ministry of Finance's answer to ${FIU_SOURCE.title}, ${FIU_SOURCE.date}.`
  );
}

/** The exchanges among `names` listed with FIU-IND, once each, in the order first seen. */
export function fiuRegistered(names: Iterable<string>): string[] {
  return [...new Set(names)].filter((name) => fiuListing(name) !== null);
}
