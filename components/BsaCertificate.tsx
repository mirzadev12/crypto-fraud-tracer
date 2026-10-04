"use client";

import { useId, useState } from "react";

/**
 * An optional, blank certificate under section 63(4) of the Bharatiya Sakshya
 * Adhiniyam, 2023, in the order of the Act's Schedule — the document a court
 * expects with an electronic record such as this packet. Its fields follow the
 * Schedule as read in the Gazette of India text
 * (docs/research/2026-10-04-india-context.md): Part A, to be filled by the
 * party; Part B, to be filled by the expert; each with a hash statement, the
 * algorithm ticked from SHA1 / SHA256 / MD5 / Other, a date in DD/MM/YYYY and a
 * time in IST, 24-hour.
 *
 * FineX never fills or signs it: the certificate is the signatory's statement,
 * not the tool's. It only points to where this packet's own SHA-256 digests are
 * printed, which the hash field may cite. Who may sign Part B was left open by
 * the Supreme Court on 22 May 2026, and the page says so instead of guessing.
 * Off by default; the switch is screen-only, the certificate prints when on.
 */

const SHEET = {
  ink: "text-[#141412]",
  body: "text-[#4a4741]",
  faint: "text-[#75726a]",
  rule: "border-[#d9d5cb]",
};

function Line({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className={`h-8 border-b ${SHEET.rule}`} />
      <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${SHEET.faint}`}>{label}</p>
    </div>
  );
}

function HashStatement({ custodyN }: { custodyN: string }) {
  return (
    <div className={`text-sm leading-7 ${SHEET.body}`}>
      <p>
        I state that the HASH value/s of the electronic/digital record/s is{" "}
        <span className={`inline-block w-48 border-b align-baseline ${SHEET.rule}`}>&nbsp;</span>, obtained
        through the following algorithm:
      </p>
      <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs">
        {["SHA1", "SHA256", "MD5", "Other"].map((a) => (
          <span key={a} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-3 border ${SHEET.rule}`} />
            {a}
          </span>
        ))}
      </p>
      <p className={`mt-2 text-xs ${SHEET.faint}`}>
        (Hash report to be enclosed with the certificate.) The SHA-256 digest of every chain response this packet
        rests on is printed in its section {custodyN}.
      </p>
    </div>
  );
}

function Part({ title, who, custodyN }: { title: string; who: string; custodyN: string }) {
  return (
    <div className={`mt-6 border-t pt-4 ${SHEET.rule}`}>
      <h3 className={`font-document text-lg ${SHEET.ink}`}>{title}</h3>
      <p className={`text-xs ${SHEET.faint}`}>{who}</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <Line label="Name" />
        <Line label="Designation / capacity" />
        <Line label="Electronic record and the device or system it was produced from" wide />
      </div>
      <div className="mt-6">
        <HashStatement custodyN={custodyN} />
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <Line label="Date (DD/MM/YYYY)" />
        <Line label="Time (IST, 24-hour)" />
        <Line label="Place" />
      </div>
      <div className="mt-6 sm:w-1/2">
        <Line label="Signature" />
      </div>
    </div>
  );
}

export default function BsaCertificate({ custodyN }: { custodyN: string }) {
  const [on, setOn] = useState(false);
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="mt-10 flex cursor-pointer items-center gap-2 text-sm text-[#4a4741] print:hidden">
        <input id={id} type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        Attach a blank certificate under BSA 2023 s.63(4), to be completed and signed by the officer
      </label>
      {on ? (
        <section className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
          <div className="flex items-baseline gap-4">
            <span className={`font-mono text-xs tracking-[0.2em] ${SHEET.faint}`}>Annex</span>
            <h2 className={`font-document text-xl leading-tight tracking-tight ${SHEET.ink}`}>
              Certificate under section 63(4)(c), Bharatiya Sakshya Adhiniyam, 2023
            </h2>
          </div>
          <p className={`mt-4 text-sm leading-7 ${SHEET.body}`}>
            The form follows the Schedule to the Act. FineX has not filled or signed any part of it: the statements
            are the signatories&rsquo; own. Who may sign Part B is a question the Supreme Court left open on
            22 May 2026; take legal advice. For a matter pending on 1 July 2024 the earlier Evidence Act may apply.
          </p>
          <Part title="Part A" who="To be filled by the party" custodyN={custodyN} />
          <Part title="Part B" who="To be filled by the expert" custodyN={custodyN} />
        </section>
      ) : null}
    </>
  );
}
