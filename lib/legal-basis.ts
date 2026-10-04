/**
 * The legal sections an officer may choose to cite on a freeze request or an
 * evidence packet — and only these. Each was read in the enacted text (Gazette
 * of India) for docs/research/2026-10-04-india-context.md; nothing outside that
 * note is offered. FineX never chooses one and never prints one by default: the
 * officer picks, and a law officer should confirm it applies to the case.
 *
 * Two rules from the research note are built in. None of these sections is
 * described as freezing a wallet (s.106 is police seizure, s.107 is a Court's
 * attachment order), and matters pending on 1 July 2024 stay under the old
 * CrPC / Evidence Act, so `regimeOf` tells the screen which regime a fraud date
 * falls under and the old numbers are never shown as current.
 */

export interface LegalBasis {
  id: string;
  /** As printed in the Gazette of India. */
  cite: string;
  title: string;
  /** What an officer would use it for, in plain words. */
  purpose: string;
  /** The section it replaced, shown as "formerly", never as current. */
  formerly: string;
  regime: "new";
}

export const LEGAL_BASES: LegalBasis[] = [
  {
    id: "bnss-94",
    cite: "BNSS 2023, s.94",
    title: "Summons to produce document or other thing",
    purpose: "Ask the exchange to produce the account's KYC and transaction records.",
    formerly: "CrPC s.91",
    regime: "new",
  },
  {
    id: "bnss-106",
    cite: "BNSS 2023, s.106",
    title: "Power of police officer to seize certain property",
    purpose: "Seize property suspected to be connected with an offence, reporting the seizure to the Magistrate.",
    formerly: "CrPC s.102",
    regime: "new",
  },
  {
    id: "bnss-107",
    cite: "BNSS 2023, s.107",
    title: "Attachment, forfeiture or restoration of property",
    purpose: "Apply to the Court for attachment of property derived from crime (a Court order, not a police power).",
    formerly: "no direct equivalent",
    regime: "new",
  },
  {
    id: "bnss-105",
    cite: "BNSS 2023, s.105",
    title: "Recording of search and seizure through audio-video electronic means",
    purpose: "Record a search or seizure, forwarded to the Magistrate.",
    formerly: "no direct equivalent",
    regime: "new",
  },
  {
    id: "bsa-63",
    cite: "BSA 2023, s.63",
    title: "Admissibility of electronic records",
    purpose: "Offer the evidence packet as an electronic record, with the s.63(4) certificate in the Schedule's form.",
    formerly: "Indian Evidence Act s.65B",
    regime: "new",
  },
];

export function legalBasis(id: string | null | undefined): LegalBasis | undefined {
  return LEGAL_BASES.find((b) => b.id === id);
}

/** The new laws took effect on 1 July 2024 (IST); a matter from before stays under the old ones. */
const COMMENCEMENT = Date.parse("2024-07-01T00:00:00.000+05:30");

export function regimeOf(fraudDate: string): "old" | "new" {
  return Date.parse(fraudDate) < COMMENCEMENT ? "old" : "new";
}
