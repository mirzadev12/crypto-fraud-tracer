"use client";

import { useRef, type ReactNode } from "react";
import { Diamond } from "./ui";

/**
 * A section that stays folded away until it is asked for.
 *
 * The landing page should carry the argument, not the manual. Detail that an
 * investigator only wants once — how the pipeline works, how an exit is named —
 * sits behind one of these rows and opens over the page.
 *
 * Built on the native `<dialog>` element: modal focus trapping, Escape to
 * close and inert background come from the platform rather than from a
 * dependency. The content stays in the document when closed, so it is still
 * indexed and still printable.
 */
export default function SectionDialog({
  index,
  title,
  kicker,
  summary,
  children,
}: {
  index: string;
  title: string;
  kicker?: string;
  summary: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="group block w-full border-t border-line pt-6 text-left transition"
      >
        <span className="flex items-center gap-4">
          <span className="font-mono text-xs tracking-[0.32em] text-brass">{index}</span>
          <Diamond className="bg-brass" />
          <span className="font-display text-xl uppercase tracking-[0.14em] text-ink md:text-2xl">
            {title}
          </span>
          <span className="h-px flex-1 bg-line transition group-hover:bg-brass-dim" />
          {kicker ? (
            <span className="hidden font-label text-xs uppercase tracking-[0.24em] text-faint sm:block">
              {kicker}
            </span>
          ) : null}
          <span className="flex shrink-0 items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition group-hover:text-brass">
            Open
            <Diamond className="bg-brass-dim" size={4} />
          </span>
        </span>
        <span className="mt-4 block max-w-2xl text-sm leading-7 text-faint">{summary}</span>
      </button>

      <dialog
        ref={ref}
        aria-label={title}
        // Clicking the backdrop lands on the dialog element itself.
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="w-[calc(100vw-32px)] max-w-3xl border border-line bg-surface p-0 text-ink backdrop:bg-[#0a0a0a]/90"
      >
        <div className="flex items-center justify-between gap-6 border-b border-line px-6 py-6 md:px-10">
          <span className="flex items-center gap-4">
            <span className="font-mono text-xs tracking-[0.32em] text-brass">{index}</span>
            <Diamond className="bg-brass" />
            <h2 className="font-display text-xl uppercase tracking-[0.14em] text-ink">
              {title}
            </h2>
          </span>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="fx-option-quiet px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass"
          >
            Close
          </button>
        </div>
        <div className="fx-scroll max-h-[70vh] overflow-y-auto px-6 py-10 md:px-10">
          {children}
        </div>
      </dialog>
    </>
  );
}
