"use client";

/**
 * Which chain the addresses on this screen belong to.
 *
 * A 0x address is valid on Ethereum and on Polygon, and is a different wallet
 * history on each, so its form alone cannot say which explorer page or wallet
 * card it opens. A screen that shows one trace says its chain once, here, and
 * every address chip inside it follows. Anything outside a scope keeps the old
 * meaning: 0x is Ethereum.
 */

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { ChainName } from "@/lib/chain-client";
import { announceChain } from "@/lib/scoped-chain";

const Scope = createContext<ChainName | null>(null);

/**
 * Given the case's address, it also tells the navigation which chain the case
 * is on, so the scoped Intelligence and Evidence links keep it (lib/scoped-chain.ts).
 */
export function ChainScope({
  chain,
  address,
  children,
}: {
  chain: ChainName;
  address?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (address) announceChain(address, chain);
  }, [address, chain]);
  return <Scope.Provider value={chain}>{children}</Scope.Provider>;
}

/** The chain of an address shown on this screen: Polygon only where the screen says so. */
export function useAddressChain(address: string): ChainName {
  const scope = useContext(Scope);
  if (!/^0x/i.test(address.trim())) return "tron";
  return scope === "polygon" ? "polygon" : "ethereum";
}
