"use client";

/**
 * The chain of the case on screen, for the navigation.
 *
 * Inside a case, the navigation points Intelligence and Evidence at the open
 * case, reading its address from the pathname. A pathname cannot say Polygon,
 * and reading the query string there would make every page render dynamically,
 * so the screen that shows the case says its chain here instead, and the
 * navigation follows it only while it is on that same address. Anything it has
 * not been told keeps the address's own form: 0x is Ethereum.
 */

import { useSyncExternalStore } from "react";

let current: { address: string; chain: string } | null = null;
const listeners = new Set<() => void>();

/** Called by a screen showing one case, when it knows the case's chain. */
export function announceChain(address: string, chain: string): void {
  const key = address.trim().toLowerCase();
  if (current && current.address === key && current.chain === chain) return;
  current = { address: key, chain };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "polygon" while the case on screen at this address is a Polygon case. */
export function useScopedChain(address: string | null): string | null {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  if (!address || !snapshot) return null;
  return snapshot.address === address.trim().toLowerCase() ? snapshot.chain : null;
}
