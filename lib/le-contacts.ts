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

/** A condition an exchange's own page states, as a code the screen words. */
export type Need =
  | "account_first"
  | "approval_first"
  | "browser"
  | "english"
  | "signed_order"
  | "wet_signature"
  | "gov_domain"
  | "official_email"
  | "duration"
  | "copiable_text"
  | "mlat"
  | "freezing_order"
  | "legal_basis";

export type LeContact =
  | {
      exchange: string;
      found: true;
      channels: LeChannel[];
      notes: string[];
      source: string;
      checked: string;
      /** Restates conditions in `notes`; nothing here that the notes do not say. */
      needs?: Need[];
      /** How long access takes to be approved, quoted from the page. */
      leadTime?: string;
      /** The sender domains the page accepts, quoted. */
      domain?: string;
    }
  | { exchange: string; found: false; reason: string; checked: string };

/** The condition in words, for a checklist before sending. */
export function needText(need: Need, contact: { leadTime?: string; domain?: string }): string {
  switch (need) {
    case "account_first":
      return "Create an account on its portal before the request can be sent.";
    case "approval_first":
      return `Portal access must be approved first${contact.leadTime ? `, generally within ${contact.leadTime}` : ""}.`;
    case "browser":
      return "Its portal works in Chrome or Edge only, and not over a VPN.";
    case "english":
      return "In English.";
    case "signed_order":
      return "Attach a signed order, or a signed letter on agency letterhead, with proof of the officer's authority.";
    case "wet_signature":
      return "Signed or sealed on paper: a digital signature or seal is not accepted.";
    case "gov_domain":
      return `Send from a government email domain${contact.domain ? ` (${contact.domain} only)` : ""}.`;
    case "official_email":
      return "Send from an official email address.";
    case "duration":
      return "State how long the restriction is to last.";
    case "copiable_text":
      return "Give wallet addresses and transaction hashes as copiable text, with the flow of funds.";
    case "mlat":
      return "A request from another country goes through a mutual legal assistance treaty where the law requires it.";
    case "freezing_order":
      return "Send a police report and a freezing order; without an order any hold is at its discretion.";
    case "legal_basis":
      return "State the legal provision the request is made under.";
  }
}

/** Whether a desk needs access of its own before it can send: a portal does. */
export function needsAccess(contact: LeContact | null): boolean {
  return Boolean(contact && contact.found && contact.channels.some((c) => c.kind === "portal"));
}

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const BY_NAME = new Map<string, LeContact>();
for (const row of contacts.exchanges as LeContact[]) BY_NAME.set(key(row.exchange), row);

/** The recorded channel for an exchange, or null when the exchange was never looked up. */
export function leContact(exchange: string | null | undefined): LeContact | null {
  if (!exchange) return null;
  return BY_NAME.get(key(exchange)) ?? null;
}
