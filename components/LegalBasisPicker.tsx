"use client";

import { useId, useState } from "react";
import { LEGAL_BASES, legalBasis, regimeOf } from "@/lib/legal-basis";

/**
 * "Issued under", chosen by the officer. FineX offers only the sections the
 * research note verified (lib/legal-basis.ts), prints one only if the officer
 * picks it, and says on screen that a law officer should confirm it applies:
 * the tool does not decide the legal basis of a request and never claims a
 * section freezes an account. The dropdown is hidden in print; the chosen
 * citation prints in the signed blank.
 *
 * A fraud dated before 1 July 2024 (IST) falls under the old CrPC and Evidence
 * Act, so the picker warns instead of letting the new numbers pass as current.
 */

// The document sheet's own tokens (SHEET in FreezeRequest.tsx), repeated here
// because FreezeRequest imports this file and a cycle would follow.
const RULE = "border-[#d9d5cb]";

export default function LegalBasisPicker({ fraudDate }: { fraudDate: string }) {
  const [choice, setChoice] = useState<string>("");
  const id = useId();
  const picked = legalBasis(choice);
  const old = regimeOf(fraudDate) === "old";

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
        <select
          id={id}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="mt-1 w-full border border-[#d9d5cb] bg-white px-2 py-2 text-sm text-[#141412]"
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
        {old ? (
          <p className="mt-2 text-xs leading-5 text-[#4a4741]">
            This fraud is dated before 1 July 2024. A matter pending on that date stays under the earlier CrPC and
            Evidence Act, so confirm which regime applies before citing any section here.
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
