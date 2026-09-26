/**
 * Who did it: the identity an action is recorded under.
 *
 * FineX holds no passwords and never will. There are two sources of an
 * identity, and the record always says which one it came from:
 *
 *  - **Verified.** A deployment behind the department's sign-in gateway sets
 *    `FINEX_IDENTITY_HEADER` to the header that gateway adds (for example
 *    `x-forwarded-email`). The gateway has already authenticated the officer;
 *    FineX takes the name from it, and takes nothing a browser says instead.
 *    Set it only when every request reaches FineX through that gateway, or
 *    anyone could send the header themselves.
 *  - **Stated.** Without a gateway, the Officer ID and unit typed at sign-in
 *    are sent with each request, and recorded as stated, not verified.
 *
 * Header values are URI-encoded by the browser, because an HTTP header cannot
 * carry a unit named in Devanagari.
 */

export interface Actor {
  /** The officer, as the source gave it. Null when nobody signed in. */
  id: string | null;
  unit: string | null;
  /** True only when a sign-in gateway in front of FineX asserted the identity. */
  verified: boolean;
}

export const OFFICER_HEADER = "x-finex-officer";
export const UNIT_HEADER = "x-finex-unit";

export const NOBODY: Actor = { id: null, unit: null, verified: false };

/** Printable, single-line, bounded; empty is null. */
export function cleanName(value: string | null | undefined, max = 80): string | null {
  if (typeof value !== "string") return null;
  let text = value;
  try {
    text = decodeURIComponent(value);
  } catch {
    // Not encoded; take it as it came.
  }
  // Control characters (a line break in a name) would let a name forge a line of the log.
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return clean || null;
}

export function actorOf(headers: Headers): Actor {
  const gateway = process.env.FINEX_IDENTITY_HEADER?.trim().toLowerCase();
  if (gateway) {
    const id = cleanName(headers.get(gateway), 120);
    // A gateway is configured but asserted nobody: the request did not come
    // through it, so nothing the browser says about itself is taken instead.
    return id ? { id, unit: cleanName(headers.get(UNIT_HEADER)), verified: true } : NOBODY;
  }
  return {
    id: cleanName(headers.get(OFFICER_HEADER)),
    unit: cleanName(headers.get(UNIT_HEADER)),
    verified: false,
  };
}

/** "I4C-2291 · Cyber Crime Cell, Bengaluru" — the name as a record prints it. */
export function actorName(actor: Actor): string {
  if (!actor.id) return "Not signed in";
  return actor.unit ? `${actor.id} · ${actor.unit}` : actor.id;
}

/** How far the name can be trusted, in the words a record prints beside it. */
export function actorBasis(actor: Actor): string {
  if (!actor.id) return "no identity given";
  return actor.verified ? "verified by the sign-in gateway" : "stated at sign-in, not verified";
}

export function readActor(value: unknown): Actor {
  if (!value || typeof value !== "object") return NOBODY;
  const r = value as Record<string, unknown>;
  const id = cleanName(typeof r.id === "string" ? r.id : null, 120);
  return id
    ? { id, unit: cleanName(typeof r.unit === "string" ? r.unit : null), verified: r.verified === true }
    : NOBODY;
}
