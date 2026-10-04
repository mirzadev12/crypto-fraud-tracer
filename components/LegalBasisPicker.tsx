"use client";

import { useId, useState } from "react";
import { LEGAL_BASES, legalBasis, regimeFor, type Pending } from "@/lib/legal-basis";

/**
 * "Issued under", chosen by the officer. FineX offers only the sections the
 * research note verified (lib/legal-basis.ts), prints one only if the officer
 * picks it, and says on screen that a law officer should confirm it applies:
 * the tool does not decide the legal basis of a request and never claims a
 * section freezes an account. The dropdown is hidden in print; the chosen
 * citation prints in the signed blank.
 *
 * Which regime applies turns on whether the matter was pending on 1 July 2024
 * (IST), which the FIR date answers, not the fraud date — so the officer says
 * so (`regimeFor`). Stated as pending, the new sections are withdrawn and the
 * line is left for the earlier provision to be written in.
 */

// The document sheet's own tokens (SHEET in FreezeRequest.tsx), repeated here
// because FreezeRequest imports this file and a cycle would follow.
const RULE = "border-[#d9d5cb]";

export default function LegalBasisPicker({ fraudDate }: { fraudDate: string }) {
  const [choice, setChoice] = useState<string>("");
  const [pending, setPending] = useState<Pending>("unstated");
  const id = useId();
  const regime = regimeFor(fraudDate, pending);
  const picked = regime === "old" ? undefined : legalBasis(choice);

  return (
    <div className="w-full">
      <div className={`flex h-8 items-end border-b pb-1 font-mono text-sm ${RULE} text-[#141412]`}>
        {picked ? `${picked.cite} — ${picked.title}` : ""}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#75726a]">Issued under</p>

      <div className="mt-3 print:hidden">
        <label htmlFor={id} className="block font-label text-[10px] uppercase tracking-[0.16em] text-[#4a4741]">
          Officer&rsquo;s choice · optional
        </label>
        <fieldset className="mb-3">
          <legend className="font-label text-[10px] uppercase tracking-[0.16em] text-[#4a4741]">
            Was the matter pending on 1 July 2024?
          </legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4a4741]">
            {(
              [
                ["unstated", "Not stated"],
                ["no", "No — FIR or complaint on or after 1 July 2024"],
                ["yes", "Yes — pending on that date"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name={`${id}-pending`}
                  value={value}
                  checked={pending === value}
                  onChange={() => setPending(value)}
                />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
        <select
          id={id}
          value={regime === "old" ? "" : choice}
          disabled={regime === "old"}
          onChange={(e) => setChoice(e.target.value)}
          className="mt-1 w-full border border-[#d9d5cb] bg-white px-2 py-2 text-sm text-[#141412] disabled:text-[#75726a]"
        >
          <option value="">Left blank, to be written in</option>
          {LEGAL_BASES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.cite} · {b.title}
            </option>
          ))}
        </select>
        {picked ? (
          <p className="mt-2 text-xs leading-5 text-[#4a4741]">
            {picked.purpose}{" "}
            {picked.formerly.startsWith("no direct")
              ? "It has no direct equivalent in the earlier code."
              : `Formerly ${picked.formerly}.`}
          </p>
        ) : null}
        {regime === "check" ? (
          <p className="mt-2 text-xs leading-5 text-[#4a4741]">
            This fraud is dated before 1 July 2024. What decides the regime is whether the matter was pending on that
            date, which the FIR or complaint date answers: say so above before citing any section here.
          </p>
        ) : regime === "old" ? (
          <p className="mt-2 text-xs leading-5 text-[#4a4741]">
            A matter pending on 1 July 2024 stays under the earlier CrPC and Evidence Act. The sections offered here
            are the new laws&rsquo;, so the line is left blank for the earlier provision to be written in, once a
            law officer confirms it.
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-[#75726a]">
          FineX does not decide the legal basis. These are the sections verified in the Gazette of India text; a law
          officer should confirm that the one chosen applies to this case. None of them is, in itself, an order to
          freeze an account.
        </p>
      </div>
    </div>
  );
}
