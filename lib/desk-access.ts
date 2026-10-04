"use client";

/**
 * Whether this desk can actually reach an exchange: its own access to the
 * exchange's law-enforcement portal, as the desk records it. A request that
 * cannot be sent because nobody on the desk was ever registered on the portal
 * is the commonest way a freeze goes nowhere, and an approval can take weeks
 * (MEXC's own page says 15 to 20 business days), so it is worth knowing before
 * the case arrives rather than after.
 *
 * Kept in this browser, like the recorded outcomes (lib/outcome-store.ts), and
 * read through `useSyncExternalStore`.
 */

import { useSyncExternalStore } from "react";

export type AccessState = { state: "applied"; on: string } | { state: "active" };
export type DeskAccess = Record<string, AccessState>;

const KEY = "finex.desk-access.v1";
const EMPTY: DeskAccess = {};
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: DeskAccess = EMPTY;

const keyOf = (exchange: string) => exchange.toLowerCase().replace(/[^a-z0-9]/g, "");

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): DeskAccess {
  const raw = readRaw();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const out: DeskAccess = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v && typeof v === "object") {
          const s = v as Record<string, unknown>;
          if (s.state === "active") out[k] = { state: "active" };
          else if (s.state === "applied" && typeof s.on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.on)) {
            out[k] = { state: "applied", on: s.on };
          }
        }
      }
    }
    cached = out;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function subscribe(listener: () => void) {
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

export function useDeskAccess(): DeskAccess {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function accessFor(all: DeskAccess, exchange: string): AccessState | null {
  return all[keyOf(exchange)] ?? null;
}

/** Record this desk's access to an exchange's portal; null clears it. False if the browser refused. */
export function setAccess(exchange: string, value: AccessState | null): boolean {
  const next = { ...snapshot() };
  if (value) next[keyOf(exchange)] = value;
  else delete next[keyOf(exchange)];
  let stored = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    stored = false;
  }
  listeners.forEach((l) => l());
  return stored;
}
