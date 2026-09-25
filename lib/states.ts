/**
 * India's 28 states and 8 union territories, so a complaint sheet's "State"
 * column groups the same place however an export spells it ("MAHARASHTRA",
 * "Orissa", "NCT of Delhi", "J&K"). A value that matches none is kept as
 * written — a sheet's own wording is never replaced by a guess.
 */

export const STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

const key = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** Former names and the abbreviations complaint exports commonly use. */
const ALIASES: Record<string, (typeof STATES_AND_UTS)[number]> = {
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  pondicherry: "Puducherry",
  newdelhi: "Delhi",
  nctofdelhi: "Delhi",
  nationalcapitalterritoryofdelhi: "Delhi",
  jandk: "Jammu and Kashmir",
  jk: "Jammu and Kashmir",
  andamanandnicobar: "Andaman and Nicobar Islands",
  aandnislands: "Andaman and Nicobar Islands",
  dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
  damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  up: "Uttar Pradesh",
  mp: "Madhya Pradesh",
  ap: "Andhra Pradesh",
  tn: "Tamil Nadu",
  wb: "West Bengal",
  hp: "Himachal Pradesh",
};

const BY_KEY = new Map<string, string>(STATES_AND_UTS.map((s) => [key(s), s]));
for (const [alias, name] of Object.entries(ALIASES)) BY_KEY.set(alias, name);

/** The canonical state or UT for a value, or null when it names none. */
export function canonicalState(raw: string): string | null {
  return BY_KEY.get(key(raw)) ?? null;
}
