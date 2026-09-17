"use client";

/**
 * Where the watch list lives: this browser.
 *
 * Not a choice made for convenience. There is no database (AGENTS.md §3), and
 * the deployment sleeps when idle, so a list held on the server would be lost
 * and nothing there could check it on a schedule anyway. The desk that shows
 * the alerts is the thing that holds the list and asks — which means the list
 * belongs to one officer's browser, and the screen says so rather than implying
 * a shared, always-on service that does not exist.
 *
 * Read through `useSyncExternalStore`, not an effect that copies storage into
 * state: the list is an external store, and synchronising it with setState in an
 * effect is the cascading-render pattern the React 19.2 lint rule fails the
 * build on (CONTEXT.md §5).
 */

import { useSyncExternalStore } from "react";
import type { WatchItem } from "./watch";

const KEY = "finex.watch.v1";
/** Enough for a morning's CRITICAL cases; the check endpoint caps at the same. */
const MAX_WATCHED = 25;
const EMPTY: WatchItem[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedItems: WatchItem[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    // Private windows, blocked site data, thumbnails: behave as an empty list.
    return null;
  }
}

function isItem(v: unknown): v is WatchItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.address === "string" &&
    typeof r.caseAddress === "string" &&
    typeof r.caseId === "string" &&
    typeof r.heldUsdt === "number" &&
    typeof r.since === "string"
  );
}

/** Stable between calls while storage is unchanged, as the store contract needs. */
function snapshot(): WatchItem[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedItems = Array.isArray(parsed) ? parsed.filter(isItem) : EMPTY;
  } catch {
    cachedItems = EMPTY;
  }
  return cachedItems;
}

function write(items: WatchItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* Storage refused: the watch simply does not persist in this browser. */
  }
  listeners.forEach((l) => l());
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

export function useWatchlist(): WatchItem[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/**
 * Put a wallet on watch. An address already watched keeps its original moment:
 * resetting it to a later read would hide movement between the two reads.
 */
export function addWatch(item: WatchItem) {
  const current = snapshot();
  if (current.some((w) => w.address === item.address)) return;
  write([item, ...current].slice(0, MAX_WATCHED));
}

export function removeWatch(address: string) {
  write(snapshot().filter((w) => w.address !== address));
}
