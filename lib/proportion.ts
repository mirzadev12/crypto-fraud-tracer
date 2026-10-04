/**
 * Whose other money is in the account a request names. A freeze request asks
 * an exchange to restrict a customer's account; if the money traced from this
 * case is a small share of what that account received, most of what would be
 * restricted is somebody else's, and the request should say so before defence
 * counsel does. Measured from the account's own history, read from the chain.
 *
 * Three answers, as everywhere in this tool: a share, a share that is only an
 * upper bound (the history was read in part), or nothing (the read failed, or
 * proves itself incomplete). Never a guess, and never a verdict: the bands
 * describe the proportion, they do not decide anything.
 */

export interface AccountShare {
  state: "computed" | "upper-bound" | "not-computed";
  /** Fraction of what the account received that is traced from this case. */
  share?: number;
  receivedUsdt?: number;
  payers?: number;
  /** One sentence for the screen. */
  sentence: string;
}

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
const usdt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function accountShare(
  tracedUsdt: number,
  profile: { readable: boolean; historyComplete: boolean; receivedUsdt: number; payers?: number } | null,
): AccountShare {
  if (!profile || !profile.readable) {
    return { state: "not-computed", sentence: "Not checked: the account's own history could not be read." };
  }
  if (profile.receivedUsdt <= 0 || tracedUsdt > profile.receivedUsdt + 0.01) {
    // More traced into it than it is read as receiving proves the read is short.
    return {
      state: "not-computed",
      sentence: "Not computed: the account's history as read is incomplete, so its total inflow is unknown.",
    };
  }
  const share = tracedUsdt / profile.receivedUsdt;
  const payers = profile.payers;
  const from = payers ? ` from ${payers.toLocaleString("en-US")} payer${payers === 1 ? "" : "s"}` : "";
  const band =
    share >= 0.5
      ? "Most of what it received is traced from this case."
      : share >= 0.1
        ? "This case is part of what it received; much of the rest came from elsewhere."
        : "Most of what it received is not from this case.";
  if (!profile.historyComplete) {
    return {
      state: "upper-bound",
      share,
      receivedUsdt: profile.receivedUsdt,
      payers,
      sentence: `The account received at least ${usdt(profile.receivedUsdt)} USDT${from} in the history read, so the money traced from this case is at most ${pct(share)} of its inflow.`,
    };
  }
  return {
    state: "computed",
    share,
    receivedUsdt: profile.receivedUsdt,
    payers,
    sentence: `The account received ${usdt(profile.receivedUsdt)} USDT${from}; the money traced from this case is ${pct(share)} of that. ${band}`,
  };
}
