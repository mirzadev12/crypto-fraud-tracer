"use client";

import { useEffect, useState } from "react";
import AddressChip from "@/components/AddressChip";
import { DataSourceBadge, TriageBadge } from "@/components/ui";
import type { DataSource } from "@/lib/api";
import type { TraceResult } from "@/lib/types";

/**
 * Where you are, and what else this case holds.
 *
 * The navigation says which *section* of the product you are in. It cannot say
 * which case you have open, how it was dispositioned, or that the page you are
 * reading has five more parts below it — and those are the three things an
 * officer working a queue needs continuously. Before this, the only way to know
 * a case file had a timeline in it was to scroll until one appeared.
 *
 * The sections are in-page anchors rather than routes. A case file is one
 * document and reads as one; splitting it across five URLs would mean five
 * loads of the same `TraceResult` and would break the single scroll an officer
 * uses to check they have read all of it. The bar marks the section currently
 * under the reader instead, so it works as a position indicator as well as a
 * jump list.
 *
 * Sticky under the navigation, and it does not print: the packet is a document
 * an officer files, and a jump list has no business on it.
 */

/**
 * One entry per section that actually exists on the page.
 *
 * If a section is added to `TraceView`, add it here and give the heading the
 * matching `id` — a tab that scrolls nowhere is worse than no tab, because the
 * reader concludes the page is broken rather than that the link is.
 */
const SECTIONS = [
  { id: "finding", name: "Finding" },
  { id: "why", name: "Why" },
  { id: "flow", name: "Fund flow" },
  { id: "timeline", name: "Timeline" },
  { id: "custody", name: "Evidence" },
] as const;

export default function CaseContextBar({
  trace,
  source,
  note,
}: {
  trace: TraceResult;
  source: DataSource;
  note?: string;
}) {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);

  /*
   * Which section the reader is in.
   *
   * An IntersectionObserver rather than a scroll handler: it reports only when
   * a boundary is crossed, so there is no work on every frame of a scroll, and
   * the whole thing unhooks itself on unmount. The top margin is what makes it
   * mark the section *under the bar* rather than the one at the very top of the
   * viewport, which is otherwise off by the height of the sticky chrome.
   */
  useEffect(() => {
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.intersectionRatio);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const { id } of SECTIONS) {
          const ratio = seen.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best) setCurrent(best);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-0 z-30 -mx-6 border-b border-line bg-bg/95 px-6 backdrop-blur print:hidden">
      {/* ------------------------------------------------------- identity */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-faint">
          {trace.caseId}
        </span>
        <AddressChip address={trace.inputAddress} tone="strong" copy explorer={false} origin={false} />
        <TriageBadge level={trace.triage} />
        <DataSourceBadge source={source} note={note} />
        <span className="ml-auto hidden font-label text-[10px] uppercase tracking-[0.2em] text-faint sm:inline">
          TRON · USDT TRC-20
        </span>
      </div>

      {/* ------------------------------------------------------- sections */}
      <div className="fx-scroll flex min-w-0 items-center gap-1 overflow-x-auto">
        {SECTIONS.map((s) => {
          const active = current === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active ? "true" : undefined}
              className={`fx-option-quiet whitespace-nowrap px-3 py-2 font-label text-[11px] uppercase tracking-[0.2em] ${
                active ? "fx-option-on text-ink" : "text-faint hover:text-brass"
              }`}
            >
              {s.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}
