/**
 * The officer signed in on this browser — the Officer ID and unit typed at
 * sign-in, kept here and sent with each request so the server can record who
 * did what (`lib/identity.ts`). No password, and nothing a gateway would not
 * replace: behind the department's sign-in, the server ignores these headers.
 *
 * A plain module, free of React: `lib/api.ts` calls `officerHeaders()` and is
 * imported by server components too, where there is no browser and so no
 * officer, and where a client hook may not be imported. The hook lives in
 * `lib/officer-store.ts`.
 */

import { OFFICER_HEADER, UNIT_HEADER, cleanName } from "./identity";

export interface Officer {
  officerId: string;
  unit: string;
}

const KEY = "finex.officer.v1";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Officer | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Stable between calls while storage is unchanged, as a store snapshot must be. */
export function currentOfficer(): Officer | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Officer>) : null;
    const officerId = cleanName(v?.officerId ?? null);
    cached = officerId ? { officerId, unit: cleanName(v?.unit ?? null) ?? "" } : null;
  } catch {
    cached = null;
  }
  return cached;
}

function write(value: Officer | null) {
  try {
    if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage refused: this browser simply has nobody signed in.
  }
  listeners.forEach((l) => l());
}

export function signIn(officer: Officer): void {
  const officerId = cleanName(officer.officerId);
  write(officerId ? { officerId, unit: cleanName(officer.unit) ?? "" } : null);
}

export function signOut(): void {
  write(null);
}

export function subscribeOfficer(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The headers every request from this browser carries; none when nobody signed in. */
export function officerHeaders(): Record<string, string> {
  const officer = currentOfficer();
  if (!officer) return {};
  return {
    [OFFICER_HEADER]: encodeURIComponent(officer.officerId),
    ...(officer.unit ? { [UNIT_HEADER]: encodeURIComponent(officer.unit) } : {}),
  };
}
