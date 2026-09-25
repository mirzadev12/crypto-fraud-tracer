"use client";

/**
 * Where the watch list lives: this browser.
 *
 * Not a choice made for convenience. There is no database (AGENTS.md §3), and a
 * host that sleeps when idle can lose whatever it held, so the list belongs to
 * one officer's browser and the screen says so. With alerts on, the server
 * checks a copy on its own schedule (`lib/alert-loop.ts`); every change here is
 * handed to it at once, from whichever screen made it, so a CRITICAL case traced
 * on its own page is watched without the desk being opened first.
 *
 * Read through `useSyncExternalStore`, not an effect that copies storage into
 * state: the list is an external store, and synchronising it with setState in an
 * effect is the cascading-render pattern the React 19.2 lint rule fails the
 * build on (CONTEXT.md §5).
 */

import { useSyncExternalStore } from "react";
import { syncAlerts } from "./alerts-client";
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
  // Handed to the server only when alerts are on in this browser; never prompts.
  void syncAlerts(items);
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
