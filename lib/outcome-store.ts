"use client";

/**
 * Where recorded outcomes live: this browser, for the same reason as the watch
 * list (lib/watchlist.ts) — there is no database, and a server that sleeps
 * could not hold them. So the screen says so, and offers export and import:
 * a unit combines its desks by merging files, never by assuming a shared store.
 *
 * Read through `useSyncExternalStore`, as the watch list is (CONTEXT.md §5).
 */

import { useSyncExternalStore } from "react";
import { mergeOutcomes, outcomeKey, readOutcome, type Outcome } from "./outcomes";

const KEY = "finex.outcomes.v1";
const EMPTY: Outcome[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedItems: Outcome[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): Outcome[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedItems = Array.isArray(parsed)
      ? parsed.map(readOutcome).filter((o): o is Outcome => o !== null)
      : EMPTY;
  } catch {
    cachedItems = EMPTY;
  }
  return cachedItems;
}

/** False when the browser refused to store it (a private window, blocked site data). */
function write(items: Outcome[]): boolean {
  let stored = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    stored = false;
  }
  listeners.forEach((l) => l());
  return stored;
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

export function useOutcomes(): Outcome[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Record or update outcomes (one per account named for a case). */
export function saveOutcomes(items: Outcome[]): boolean {
  return write(mergeOutcomes(snapshot(), items));
}

export function removeOutcome(o: Outcome): void {
  const k = outcomeKey(o);
  write(snapshot().filter((x) => outcomeKey(x) !== k));
}

/** Merge a file exported from another desk. Returns how many records it held. */
export function importOutcomes(parsed: unknown): number {
  const list = Array.isArray(parsed) ? parsed.map(readOutcome).filter((o): o is Outcome => o !== null) : [];
  if (list.length) write(mergeOutcomes(snapshot(), list));
  return list.length;
}
