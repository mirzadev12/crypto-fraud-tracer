"use client";

/**
 * The findings fingerprint on a document, and the check a copy is opened with.
 *
 * A document prints the fingerprint of its findings and a link that re-opens
 * the same run pinned to the moment it was read (lib/fingerprint.ts). Opened
 * with the fingerprint in the link, the evidence packet re-derives the case
 * and says whether its findings still produce it — so a printed or forwarded
 * copy can be checked by anyone with the link, without trusting whoever sent it.
 */

import { useSyncExternalStore } from "react";
import QrCode from "./QrCode";
import { buttonStyles } from "./ui";
import { formatDateTime } from "@/lib/format";
import { groupFingerprint } from "@/lib/fingerprint";

// The documents' light-sheet palette (EvidencePacket, FreezeRequest), repeated
// rather than imported: FreezeRequest imports this file.
const SHEET = {
  ink: "text-[#141412]",
  body: "text-[#4a4741]",
  faint: "text-[#75726a]",
};

const subscribe = () => () => {};

/** The deployment this document was generated on; empty during server render. */
function useOrigin(): string {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}

/**
 * The fingerprint as a document prints it. `href` is the check link from
 * `verifyHref`; an illustrative case passes none, because there is no chain
 * record to check it against, and the block says so.
 */
export function FingerprintBlock({
  fingerprint,
  href,
  readAt,
  qr = false,
}: {
  fingerprint: string;
  href: string | null;
  readAt: string;
  /** A scannable code beside the link, for a document that will be printed. */
  qr?: boolean;
}) {
  const origin = useOrigin();
  const url = href && origin ? `${origin}${href}` : href;
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
          Findings fingerprint · SHA-256
        </p>
        <p className={`mt-1 font-mono text-sm leading-7 wrap-anywhere ${SHEET.ink}`}>
          {groupFingerprint(fingerprint)}
        </p>
        <p className={`mt-4 text-sm leading-7 ${SHEET.body}`}>
          Computed from the findings — every wallet, transfer, amount, time, attribution and rule
          that fired, and the disposition — not from the wording.{" "}
          {url
            ? `To check a copy, open the link${qr ? " or scan the code" : ""}: FineX re-derives the case from the public chain as of ${formatDateTime(readAt)} and states whether its findings still produce this fingerprint.`
            : "This is an illustrative case, built by hand on an address that was never on the chain, so there is no chain record to check a copy against."}
        </p>
        {url ? (
          <p className={`mt-4 font-mono text-xs leading-6 wrap-anywhere ${SHEET.body}`}>
            <a href={url} className="underline decoration-[#d9d5cb] underline-offset-4">
              {url}
            </a>
          </p>
        ) : null}
      </div>
      {qr && url && origin ? (
        <QrCode
          text={url}
          label="Code that opens the check link for this packet"
          className="size-32 justify-self-start"
        />
      ) : null}
    </div>
  );
}

/**
 * The answer to "is this copy genuine?", shown above a packet opened from a
 * check link. Console chrome: it never prints, because what prints is the
 * packet itself.
 */
export function FingerprintCheck({
  expected,
  actual,
  source,
  readAt,
  onRetry,
}: {
  /** The fingerprint the copy states, from the link. */
  expected: string;
  /** The fingerprint of the findings as re-derived now. */
  actual: string;
  source: "live" | "demo" | "illustrative";
  readAt: string;
  /** Re-derives the case again, for a mismatch that may be a read the chain refused. */
  onRetry?: () => void;
}) {
  if (source === "illustrative") {
    return (
      <div className="border-l-2 border-line pl-4 print:hidden">
        <p className="font-label text-xs uppercase tracking-[0.18em] text-faint">
          Fingerprint check · not possible
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
          This is an illustrative case, built by hand on an address that was never on the chain,
          so there is no chain record to check a copy against.
        </p>
      </div>
    );
  }
  const from = source === "demo" ? "from the recorded case file" : "from the public chain";
  const match = expected === actual;
  return (
    <div
      className={`border-l-2 pl-4 print:hidden ${match ? "border-confirmed" : "border-critical"}`}
      role="status"
    >
      <p
        className={`font-label text-xs uppercase tracking-[0.18em] ${match ? "text-confirmed" : "text-critical"}`}
      >
        {match ? "Fingerprint matches" : "Fingerprint does not match"}
      </p>
      {match ? (
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
          The findings re-derived {from} as of {formatDateTime(readAt)} produce the fingerprint the
          copy states, <span className="font-mono text-ink wrap-anywhere">{groupFingerprint(actual)}</span>.
          Every wallet, transfer, amount, attribution and rule below is what that copy states. The
          fingerprint does not cover wording: where the copy&rsquo;s sentences differ from this
          page, this page is the re-derived record.
        </p>
      ) : (
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
          The copy states{" "}
          <span className="font-mono text-ink wrap-anywhere">{groupFingerprint(expected)}</span>; the
          findings re-derived {from} as of {formatDateTime(readAt)} produce{" "}
          <span className="font-mono text-ink wrap-anywhere">{groupFingerprint(actual)}</span>. Three
          things cause this: part of the chain could not be read just now, so check again before
          relying on it; FineX&rsquo;s attribution tables or rules have changed since the copy was
          issued; or the copy was altered. The packet below is the finding as re-derived now:
          compare its figures with the copy.
        </p>
      )}
      {!match && onRetry ? (
        <button type="button" onClick={onRetry} className={`${buttonStyles.secondary} mt-4`}>
          Check again
        </button>
      ) : null}
    </div>
  );
}

/** One case's fingerprint and check link, as a line in a document that lists several. */
export function FingerprintLine({
  label,
  fingerprint,
  href,
}: {
  label: string;
  fingerprint: string;
  href: string | null;
}) {
  const origin = useOrigin();
  const url = href && origin ? `${origin}${href}` : href;
  return (
    <li className="min-w-0 text-xs leading-6">
      <span className={`font-mono uppercase tracking-[0.14em] ${SHEET.faint}`}>{label}</span>
      <span className={`block font-mono wrap-anywhere ${SHEET.ink}`}>
        {groupFingerprint(fingerprint)}
      </span>
      {url ? (
        <a
          href={url}
          className={`block font-mono wrap-anywhere underline decoration-[#d9d5cb] underline-offset-4 ${SHEET.body}`}
        >
          {url}
        </a>
      ) : (
        <span className={`block ${SHEET.body}`}>Illustrative case: nothing on the chain to check it against.</span>
      )}
    </li>
  );
}
