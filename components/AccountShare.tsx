"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { accountShare } from "@/lib/proportion";
import type { WalletProfile } from "@/lib/wallet";
import { Designation } from "./ui";

/**
 * Before the request goes out: how much of the named account's inflow is this
 * case's (lib/proportion.ts). Read from the account's own history through the
 * wallet route, once, when the request opens. Console chrome: it informs the
 * officer and does not print, because the letter asks the exchange to restrict
 * and review, not to treat the whole account as proceeds.
 */
export default function AccountShare({
  account,
  tracedUsdt,
  chain,
}: {
  account: string;
  tracedUsdt: number;
  chain: string;
}) {
  const key = `${chain}:${account}`;
  // Tagged with the account it answers for, so "reading" is derived, not set in the effect.
  const [read, setRead] = useState<{ for: string; profile: WalletProfile | null } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      let profile: WalletProfile | null = null;
      try {
        const res = await fetch(
          `/api/wallet/${encodeURIComponent(account)}${chain === "polygon" ? "?chain=polygon" : ""}`,
        );
        if (res.ok) profile = (await res.json()) as WalletProfile;
      } catch {
        // An unanswered read is said as one below, never as an empty account.
      }
      if (live) setRead({ for: key, profile });
    })();
    return () => {
      live = false;
    };
  }, [account, chain, key]);

  const current = read && read.for === key ? read : null;
  const share = current ? accountShare(tracedUsdt, current.profile) : null;

  return (
    <section className="border-l-2 border-line pl-4 print:hidden" aria-label="Whose other money is in this account">
      <Designation>Whose other money is in this account</Designation>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted" role="status">
        {share ? share.sentence : "Reading the account's own history…"}
      </p>
      {share && share.state !== "not-computed" ? (
        <p className="mt-1 max-w-3xl text-xs leading-6 text-faint">
          The account&rsquo;s history as read {current?.profile ? formatDateTime(current.profile.provenance.generatedAt) : ""},
          which can include money that arrived after this trace was read. The request asks the exchange to restrict and
          review the account; it does not allege that everything in it is proceeds of this case.
        </p>
      ) : null}
    </section>
  );
}
