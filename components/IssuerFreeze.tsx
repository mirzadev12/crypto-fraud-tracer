"use client";

/**
 * One line: has Tether, the issuer of USDT, frozen this address?
 *
 * Read live from the USDT contract's own blacklist through `/api/issuer`, so
 * it describes the chain now, not the moment a recorded case was captured —
 * which is why the line always carries the time it was checked. Three answers,
 * never two: frozen, not frozen, or not checked. See lib/issuer.ts.
 */

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type Answer =
  | { status: "frozen" | "not-frozen"; checkedAt: string }
  | { status: "unchecked"; reason?: string };

export default function IssuerFreeze({ address }: { address: string }) {
  // Tagged with the address it answers for, so a result can never sit under a
  // different wallet, and "checking" is derived rather than set in the effect.
  const [result, setResult] = useState<{ for: string; answer: Answer } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/issuer/${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((answer: Answer) => {
        if (live) setResult({ for: address, answer });
      })
      .catch(() => {
        if (live) setResult({ for: address, answer: { status: "unchecked" } });
      });
    return () => {
      live = false;
    };
  }, [address]);

  const answer = result?.for === address ? result.answer : null;

  return (
    <p className="text-sm leading-6 text-muted" aria-live="polite">
      <span className="font-label text-xs uppercase tracking-[0.18em] text-faint">
        Issuer freeze ·{" "}
      </span>
      {!answer ? (
        <span className="text-faint">checking the USDT contract…</span>
      ) : answer.status === "frozen" ? (
        <>
          <span className="font-semibold text-confirmed">Frozen by Tether.</span> This address is on
          the USDT contract&rsquo;s blacklist, so its USDT cannot move. Checked{" "}
          {formatDateTime(answer.checkedAt)}.
        </>
      ) : answer.status === "not-frozen" ? (
        <>
          Not frozen by Tether as of {formatDateTime(answer.checkedAt)}. The issuer can freeze USDT
          at any address — a route that does not depend on an exchange.
        </>
      ) : (
        <span className="text-faint">
          Not checked — the chain did not answer. Nothing is stated about it.
        </span>
      )}
    </p>
  );
}
