/**
 * Where an exchange takes law-enforcement requests (`data/le-contacts.json`).
 *
 * The freeze request names the account and drafts the letter; this says where
 * to send it, and what that exchange requires before it will act. Every entry
 * was copied from the exchange's own published page, which it links, on the
 * date it gives. Two rules:
 *
 *  - Nothing is inferred. An exchange whose page could not be read is recorded
 *    as not found, with the reason, and the screen says so.
 *  - It is dated guidance, not a guarantee: exchanges change their channels,
 *    and the screen tells the officer to check the source before relying on it.
 */

import contacts from "../data/le-contacts.json";

export interface LeChannel {
  kind: "portal" | "email" | "form";
  label: string;
  href: string;
}

export type LeContact =
  | {
      exchange: string;
      found: true;
      channels: LeChannel[];
      notes: string[];
      source: string;
      checked: string;
    }
  | { exchange: string; found: false; reason: string; checked: string };

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const BY_NAME = new Map<string, LeContact>();
for (const row of contacts.exchanges as LeContact[]) BY_NAME.set(key(row.exchange), row);

/** The recorded channel for an exchange, or null when the exchange was never looked up. */
export function leContact(exchange: string | null | undefined): LeContact | null {
  if (!exchange) return null;
  return BY_NAME.get(key(exchange)) ?? null;
}
