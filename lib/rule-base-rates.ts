/**
 * How often a behavioural rule fires on wallets nobody reported: measured, not
 * assumed (scripts/calibrate-risk.mjs, on a sample of 17 unreported TRON
 * wallets; the figures are the ones /operations states). Shown beside a rule
 * wherever it fires, so a rule that fires on nearly every busy wallet is read
 * as the weak signal it is rather than as proof of laundering. Only measured
 * rules are listed; a rule without a measured rate states none, and the rates
 * say TRON because that is the only chain they were measured on.
 */
import type { RiskFlag } from "./types";

export const BASE_RATES: Partial<Record<RiskFlag["code"], { fired: number; sample: number }>> = {
  PEEL_CHAIN: { fired: 16, sample: 17 },
  HIGH_FANOUT: { fired: 15, sample: 17 },
  SANCTIONED_CONTACT: { fired: 0, sample: 17 },
};

const weak = (r: { fired: number; sample: number }) => r.fired * 2 >= r.sample;

/** The sentence for a rule's base rate, or null when none was measured. */
export function baseRateNote(code: string): string | null {
  const rate = BASE_RATES[code as RiskFlag["code"]];
  if (!rate) return null;
  return `Fires on ${rate.fired === 0 ? "none" : rate.fired} of a sample of ${rate.sample} TRON wallets nobody reported${
    weak(rate) ? ": weak on its own" : ""
  }.`;
}

/** The measured rates of several rules, as one sentence; null when none was measured. */
export function baseRateSentence(codes: string[]): string | null {
  const measured = codes
    .map((c) => ({ c, rate: BASE_RATES[c as RiskFlag["code"]] }))
    .filter((x): x is { c: string; rate: { fired: number; sample: number } } => Boolean(x.rate));
  if (!measured.length) return null;
  const name = (c: string) => c.toLowerCase().replace(/_/g, " ");
  const sample = measured[0].rate.sample;
  const parts = measured.map(({ c, rate }) => `${name(c)} fires on ${rate.fired === 0 ? "none" : rate.fired}`);
  const weakOnes = measured.filter(({ rate }) => weak(rate)).map(({ c }) => name(c));
  return `Measured on a sample of ${sample} TRON wallets nobody reported, ${parts.join(", ")}${
    weakOnes.length
      ? `, so ${weakOnes.length === 1 ? `${weakOnes[0]} is a weak signal` : `${weakOnes.join(" and ")} are weak signals`} on ${weakOnes.length === 1 ? "its" : "their"} own`
      : ""
  }.`;
}
