/**
 * How an attribution is allowed to be worded.
 *
 * Lifted out of `components/ui.tsx` so the server can use it too: the narrative
 * is assembled in the tracer, and the one rule that decides how an entity may
 * be named must not have two implementations. `ui.tsx` re-exports this, so
 * every existing import is unchanged.
 *
 * Pure and React-free on purpose — a "use client" module cannot be imported
 * into the tracer without dragging the client runtime onto the server.
 */

/**
 * What kind of wallet something is, as a short tag beside its name.
 *
 * The contract's kind codes are not interface copy. Printed as they stand,
 * "exchange_hot" reads EXCHANGE HOT — the internal code for a CRITICAL case,
 * which the interface otherwise never shows — and it was printed in the
 * critical red besides. Every screen that tags a wallet's kind asks here.
 */
export function kindTag(kind: string | null | undefined): string {
  switch (kind) {
    case "victim_reported":
      return "Reported wallet";
    case "intermediary":
      return "Intermediary";
    case "exchange_deposit":
      return "Customer deposit address";
    case "exchange_hot":
      return "Exchange hot wallet";
    case "mixer":
      return "Mixing service";
    case "sanctioned":
      return "Sanctioned address";
    default:
      return "Unlabelled";
  }
}

/**
 * How an attribution is allowed to be worded.
 *
 * A clustering heuristic supports "likely X deposit cluster". It does not
 * support "this wallet is X". The distinction is the difference between an
 * investigative lead and a claim we would have to defend in court, so the
 * phrasing lives in one place and every screen uses it.
 */
export function entityPhrase(
  label:
    | { entity: string; kind: string | null; source: string | null }
    | null
    | undefined,
): string {
  if (!label || !label.kind) return "Unlabelled wallet";
  const certain = label.source === "ground_truth" || label.source === "sanctions";
  switch (label.kind) {
    case "victim_reported":
      return "Victim-reported wallet";
    case "exchange_deposit":
      return certain
        ? `${label.entity} deposit address`
        : `Likely ${label.entity} deposit cluster`;
    case "exchange_hot":
      return certain ? `${label.entity} hot wallet` : `Likely ${label.entity} hot wallet`;
    case "mixer":
      return certain ? label.entity : `Likely mixing service`;
    case "sanctioned":
      return `${label.entity} — sanctioned`;
    default:
      return label.entity;
  }
}
