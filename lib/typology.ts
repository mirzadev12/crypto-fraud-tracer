/**
 * The scam typology a complaint reports, as the officer or the complaint sheet
 * states it. FineX never infers a typology from the chain: the same USDT trail
 * can follow a digital-arrest call or a fake trading app, and only the victim's
 * account of it can say which. The list follows the problem statement's own
 * (investment scams, task-based frauds, sextortion, ransomware, phishing,
 * darknet) with digital arrest first, the form MHA and I4C have warned about
 * most. Shown on the case file, the evidence packet and the freeze request;
 * carried between them in the link (`?typology=`) like the acknowledgement
 * number, and dropped if it is not on this list.
 */

export const TYPOLOGIES = [
  { id: "digital-arrest", label: "Digital arrest" },
  { id: "task-job", label: "Task-based job fraud" },
  { id: "investment-app", label: "Investment / trading app" },
  { id: "sextortion", label: "Sextortion" },
  { id: "loan-app", label: "Loan app" },
  { id: "ransomware", label: "Ransomware" },
  { id: "phishing", label: "Phishing" },
  { id: "darknet", label: "Darknet market" },
  { id: "other", label: "Other" },
] as const;

export type TypologyId = (typeof TYPOLOGIES)[number]["id"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const BY_KEY = new Map<string, TypologyId>();
for (const t of TYPOLOGIES) {
  BY_KEY.set(norm(t.id), t.id);
  BY_KEY.set(norm(t.label), t.id);
}

/** A listed typology from an id or a complaint sheet's wording, or undefined. */
export function parseTypology(raw: string | null | undefined): TypologyId | undefined {
  if (!raw) return undefined;
  return BY_KEY.get(norm(raw));
}

export function typologyLabel(id: TypologyId): string {
  return TYPOLOGIES.find((t) => t.id === id)?.label ?? id;
}
