"use client";

/**
 * The signed-in officer as a React store, read through `useSyncExternalStore`
 * rather than copied into state by an effect (CONTEXT.md §5). The store itself
 * is `lib/officer.ts`, which stays free of React so server code can import it.
 */

import { useSyncExternalStore } from "react";
import { currentOfficer, subscribeOfficer, type Officer } from "./officer";

export function useOfficer(): Officer | null {
  return useSyncExternalStore(subscribeOfficer, currentOfficer, () => null);
}
