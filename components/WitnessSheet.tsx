"use client";

import { useId, useState } from "react";
import type { TraceResult } from "@/lib/types";
import { witnessSheet } from "@/lib/witness";

/**
 * Prepare for court: the questions defence counsel will put about this case,
 * answered from its own record (lib/witness.ts). It is for the officer, not
 * the court, so it sits outside the filed packet and is closed by default; it
 * prints only when the officer asks for it.
 */
export default function WitnessSheet({
  trace,
  fingerprint,
  recorded,
}: {
  trace: TraceResult;
  fingerprint: string;
  recorded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [printIt, setPrintIt] = useState(false);
  const id = useId();
  const items = witnessSheet(trace, { fingerprint, recorded });

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`mx-auto max-w-4xl border-t border-line pt-6 print:border-[#d9d5cb] ${printIt ? "fx-print-sheet" : "print:hidden"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="font-display text-lg tracking-wide text-ink print:text-[#141412]">
            Prepare for court
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted print:text-[#4a4741]">
            {items.length} questions counsel can be expected to ask about this finding, each answered from this
            case&rsquo;s own record, with what the answer does not establish. For the officer; not part of the filed
            packet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={printIt}
              onChange={(e) => {
                setPrintIt(e.target.checked);
                if (e.target.checked) setOpen(true);
              }}
            />
            Print with the packet
          </label>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={() => setOpen(!open)}
            className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-brass"
          >
            {open ? "Hide the questions" : "Show the questions"}
          </button>
        </div>
      </div>

      {open ? (
        <ol id={`${id}-list`} className="mt-6 divide-y divide-line border-y border-line print:divide-[#d9d5cb] print:border-[#d9d5cb]">
          {items.map((item, i) => (
            <li
              key={item.question}
              className="fx-print-block fx-rise grid gap-2 py-4 md:grid-cols-[2rem_1fr]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="font-mono text-xs tabular-nums text-faint print:text-[#75726a]">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="text-sm text-ink print:text-[#141412]">{item.question}</p>
                <p className="mt-2 text-sm leading-7 text-muted wrap-anywhere print:text-[#4a4741]">{item.answer}</p>
                <p className="mt-2 text-xs leading-6 text-faint print:text-[#75726a]">
                  <span className="font-label uppercase tracking-[0.16em] text-suspicious print:text-[#8a5a14]">Limit</span>{" "}
                  {item.limit}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
