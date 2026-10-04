"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import { tailWallets } from "@/lib/leads";
import type { TraceResult } from "@/lib/types";
import { Panel } from "./ui";

/**
 * Where the trail left the search: the wallets at the last hop that were still
 * sending when the trace stopped, each with the public block explorer's own tag,
 * read now (GET /api/tag). The tag is the explorer's words, shown as such —
 * not FineX's attribution, and not used for the finding — so it can only add a
 * lead, never change one. TRON only: Ethereum's explorer puts its tags on
 * transfers, not on addresses.
 *
 * Read one wallet at a time, heaviest first, so a trail with many tail wallets
 * never fires a burst at the explorer.
 */

const SHOWN = 5;

type Read = { tag: string | null; readAt: string } | "unanswered";

export default function TailTags({ trace }: { trace: TraceResult }) {
  const tail =
    trace.chain === "tron"
      ? [...tailWallets(trace)].sort((a, b) => b.taintedValueUsdt - a.taintedValueUsdt).slice(0, SHOWN)
      : [];
  const key = tail.map((n) => n.address).join(",");
  const [reads, setReads] = useState<{ key: string; byAddress: Record<string, Read> }>({ key: "", byAddress: {} });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    (async () => {
      for (const address of key.split(",")) {
        let read: Read = "unanswered";
        try {
          const res = await fetch(`/api/tag/${encodeURIComponent(address)}`, { cache: "no-store" });
          if (res.ok) {
            const body = (await res.json()) as { tag?: string | null; readAt?: string };
            read = { tag: body.tag ?? null, readAt: body.readAt ?? "" };
          }
        } catch {
          // Stays "unanswered".
        }
        if (!alive) return;
        setReads((prev) => ({
          key,
          byAddress: { ...(prev.key === key ? prev.byAddress : {}), [address]: read },
        }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  if (!tail.length) return null;
  const byAddress = reads.key === key ? reads.byAddress : {};

  return (
    <Panel
      title="Where the trail left the search"
      subtitle="Each wallet's public explorer tag, read now. The explorer's words, not FineX's attribution."
      className="mt-6"
    >
      <ul className="divide-y divide-line-soft">
        {tail.map((n) => {
          const read = byAddress[n.address];
          return (
            <li key={n.address} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
              <span className="font-mono text-sm text-ink" title={n.address}>
                {shortAddress(n.address)}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {formatUsdt(n.taintedValueUsdt)} still moving
              </span>
              <span className="w-full text-xs leading-5 sm:w-auto">
                {read === undefined ? (
                  <span className="text-faint">Reading the explorer…</span>
                ) : read === "unanswered" ? (
                  <span className="text-faint">The explorer did not answer; nothing is known either way.</span>
                ) : read.tag ? (
                  <span className="text-ink" title={`Read ${formatDateTime(read.readAt)}`}>
                    Explorer tag: <span className="text-brass">{read.tag}</span>
                  </span>
                ) : (
                  <span className="text-faint" title={`Read ${formatDateTime(read.readAt)}`}>
                    No public tag
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs leading-5 text-faint">
        The trace stops at its search limit by design; these wallets were still sending when it did.
        A tag here is a lead to follow up, not a finding: it does not change the case&rsquo;s status or
        its exit.
      </p>
    </Panel>
  );
}
