"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import AddressChip from "@/components/AddressChip";
import { DataSourceBadge, TriageBadge } from "@/components/ui";
import type { DataSource } from "@/lib/api";
import type { TraceResult } from "@/lib/types";
import { chainMeta } from "@/lib/chain-meta";

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
  { id: "next", name: "What next" },
  { id: "why", name: "Why" },
  { id: "flow", name: "Fund flow" },
  { id: "timeline", name: "Timeline" },
  { id: "custody", name: "Evidence" },
] as const;

export default function CaseContextBar({
  trace,
  source,
  note,
  asOf,
  actions,
}: {
  trace: TraceResult;
  source: DataSource;
  note?: string;
  asOf?: string;
  /**
   * The case's own actions — fund flow, packet, freeze request. They ride in
   * the bar on wide screens so the next step is one click from anywhere in the
   * file, not only from its top; below `xl` the page carries them instead,
   * because a sticky bar that wraps to two or three lines hides the page.
   */
  actions?: ReactNode;
}) {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);
  const barRef = useRef<HTMLDivElement>(null);

  /*
   * Which section the reader is in: the last one whose heading has passed
   * under the sticky chrome (the navigation plus this bar), or the last one of
   * all once the page is scrolled to its end.
   *
   * Read once per animation frame while scrolling. It used to be an
   * IntersectionObserver on the headings, which only reported when a heading
   * crossed a narrow band — so a jump, or a fast scroll past a short heading,
   * left the bar marking a section the reader had already left.
   */
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 0;
      // Past the bar with room to spare: a jump lands a heading 7rem under the
      // navigation (.fx-anchor), which must count as having reached it.
      const line = navH + (barRef.current?.offsetHeight ?? 90) + 40;
      let best: string = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) best = id;
      }
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atEnd) best = SECTIONS[SECTIONS.length - 1].id;
      setCurrent(best);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    // Pinned under the navigation (its height is --nav-h), not at the top of
    // the viewport, where the navigation is drawn over it.
    <div
      ref={barRef}
      className="sticky top-[var(--nav-h,0px)] z-30 -mx-6 border-b border-line bg-bg/95 px-6 backdrop-blur print:hidden"
    >
      {/* ------------------------------------------------------- identity */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-faint">
          {trace.caseId}
        </span>
        <AddressChip address={trace.inputAddress} tone="strong" copy explorer={false} origin={false} />
        <TriageBadge level={trace.triage} />
        <DataSourceBadge source={source} note={note} asOf={asOf} />
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden font-label text-[10px] uppercase tracking-[0.2em] text-faint sm:inline xl:hidden 2xl:inline">
            {chainMeta(trace.chain).scope}
          </span>
          {actions ? <div className="hidden items-center gap-2 xl:flex">{actions}</div> : null}
        </div>
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
              className={`fx-option-quiet shrink-0 whitespace-nowrap px-4 py-2 font-label text-[11px] uppercase tracking-[0.2em] ${
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
