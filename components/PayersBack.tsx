"use client";

/**
 * Payers, one hop back — where each payer's own USDT came from (lib/payers.ts).
 *
 * Asked for, never loaded on its own: it costs a chain read per payer, up to
 * twenty, and most visits to a wallet card do not need it. The answer it gives
 * is the one an officer can act on — which exchanges funded the wallets that
 * paid this one, because USDT an exchange sends out is a withdrawal it can put
 * a customer's name to. It never calls a payer a victim: the chain says where
 * the money came from, not who the person was.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { count, formatDateTime, formatUsdt } from "@/lib/format";
import { fiuListing } from "@/lib/fiu";
import { displayTag } from "@/lib/explorer-tags";
import type { PayersTrace, TracedPayer } from "@/lib/payers";
import { Designation, Panel, Spinner, buttonStyles, entityPhrase } from "./ui";

type Answer = { status: "ready"; trace: PayersTrace } | { status: "error"; reason: string };

export default function PayersBack({ address }: { address: string }) {
  const [asked, setAsked] = useState<string | null>(null);
  // Tagged with the address it answers for, so a result never sits under
  // another wallet, and "reading" is derived rather than set in the effect.
  const [result, setResult] = useState<{ for: string; answer: Answer } | null>(null);

  useEffect(() => {
    if (asked !== address) return;
    let live = true;
    fetch(`/api/payers/${encodeURIComponent(address)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        return body as PayersTrace;
      })
      .then((trace) => live && setResult({ for: address, answer: { status: "ready", trace } }))
      .catch((err: unknown) => {
        if (live) {
          setResult({
            for: address,
            answer: { status: "error", reason: err instanceof Error ? err.message : "The payers could not be read." },
          });
        }
      });
    return () => {
      live = false;
    };
  }, [asked, address]);

  const answer = result?.for === address ? result.answer : null;
  const reading = asked === address && !answer;

  return (
    <Panel
      title="Payers, one hop back"
      subtitle="Where each payer's own USDT came from. The exchange that sent it can name who withdrew it."
      framed={false}
    >
      {!asked || asked !== address ? (
        <div className="pt-6">
          <p className="max-w-2xl text-sm leading-7 text-muted">
            Reads the history of the largest twenty payers up to the moment each paid in, and
            names any exchange among their sources. It makes a chain read per payer, so it takes
            up to a minute.
          </p>
          <button type="button" onClick={() => setAsked(address)} className={`${buttonStyles.secondary} mt-6`}>
            Trace the payers back
          </button>
        </div>
      ) : reading ? (
        <p className="flex items-center gap-4 pt-6 text-sm text-muted">
          <Spinner /> Reading each payer&rsquo;s history up to the moment it paid…
        </p>
      ) : answer?.status === "error" ? (
        <div className="pt-6">
          <p className="text-sm leading-7 text-muted">
            The payers could not be read: {answer.reason}
          </p>
          <button type="button" onClick={() => { setResult(null); setAsked(null); }} className={`${buttonStyles.secondary} mt-4`}>
            Try again
          </button>
        </div>
      ) : answer?.status === "ready" ? (
        <Result trace={answer.trace} />
      ) : null}
    </Panel>
  );
}

function Result({ trace }: { trace: PayersTrace }) {
  if (!trace.readable) {
    return (
      <p className="pt-6 text-sm leading-7 text-muted">
        The chain did not answer for this wallet, so nothing is stated about who paid it.
      </p>
    );
  }
  if (!trace.payers.length) {
    return (
      <p className="pt-6 text-sm leading-7 text-faint">
        Nothing of 1 USDT or more was paid into this wallet in the history read.
      </p>
    );
  }
  const unread = trace.payers.filter((p) => p.status === "unreadable").length;
  return (
    <div className="space-y-10 pt-6">
      <p className="max-w-3xl text-sm leading-7 text-muted">
        {count(trace.payers.length, "wallet")} paid this address{" "}
        <span className="font-mono tabular-nums text-ink">{formatUsdt(trace.totalPaidUsdt)}</span> in
        transfers of 1 USDT or more
        {trace.historyComplete ? "" : " (in the history read; more exists)"}. The largest{" "}
        {trace.followed} were read back to their funding
        {unread ? `, ${unread} of them could not be read` : ""}.
      </p>

      <div>
        <Designation>Exchanges that funded a payer</Designation>
        {trace.exchanges.length ? (
          <>
            <ul className="mt-4 divide-y divide-line-soft">
              {trace.exchanges.map((e) => {
                const fiu = fiuListing(e.entity);
                return (
                  <li key={e.entity} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{e.entity}</p>
                      <p className="mt-1 font-label text-[10px] uppercase tracking-[0.14em] text-faint">
                        {e.via === "explorer" ? "Named by the explorer's tag" : "From the attribution register"}
                        {fiu ? <span className="text-brass"> · FIU-IND registered · 2023 list</span> : null}
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-mono text-sm tabular-nums text-ink">
                      {count(e.payers, "payer")} · {formatUsdt(e.paidUsdt)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 max-w-3xl text-xs leading-6 text-faint">
              USDT an exchange sends out is a withdrawal by one of its customers, so each exchange
              above can say who funded the payers it is listed against. The figure is what those
              payers paid into this wallet.
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            No exchange is named among the payers or their sources.{" "}
            {trace.chain === "ethereum"
              ? "Their funding came from wallets that neither the attribution register nor the explorer's tags name."
              : "On TRON only the attribution register names wallets — the chain's transfer records carry no explorer tags — and it names none of their sources."}
          </p>
        )}
      </div>

      <div>
        <Designation>Payers, largest first</Designation>
        <ul className="mt-2 divide-y divide-line-soft">
          {trace.payers.map((p) => (
            <li key={p.address} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <Link
                  href={`/wallet/${encodeURIComponent(p.address)}`}
                  className="fx-option-quiet inline-block break-all px-2 py-1 font-mono text-sm text-ink transition hover:text-brass"
                >
                  {p.address}
                </Link>
                <p className="mt-2 pl-2 text-xs leading-5 text-faint">
                  {count(p.transfers, "payment")} · {formatDateTime(p.firstAt)}
                  {p.lastAt !== p.firstAt ? ` to ${formatDateTime(p.lastAt)}` : ""}
                </p>
                <Funding payer={p} cap={trace.cap} />
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-base font-light tabular-nums text-ink">
                  {formatUsdt(p.paidUsdt, { symbol: false })}
                </p>
                <p className="font-label text-xs uppercase tracking-[0.2em] text-faint">USDT paid in</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Funding({ payer, cap }: { payer: TracedPayer; cap: number }) {
  const line = "mt-1 pl-2 text-xs leading-5";
  switch (payer.status) {
    case "labelled":
      return <p className={`${line} text-muted`}>Is itself {payer.label ? entityPhrase(payer.label) : "a labelled wallet"}.</p>;
    case "contract":
      return <p className={`${line} text-faint`}>A smart contract — not followed.</p>;
    case "unreadable":
      return <p className={`${line} text-faint`}>Could not be read, so its funding is not stated.</p>;
    case "skipped":
      return <p className={`${line} text-faint`}>Beyond the largest {cap}; not read back.</p>;
    default:
      if (!payer.sources.length) {
        return (
          <p className={`${line} text-faint`}>
            {payer.partial
              ? "No USDT of 1 or more came in within the transfers read before it paid."
              : "Received no USDT of 1 or more before it paid — its USDT came some other way (a swap, or another token)."}
          </p>
        );
      }
      return (
        <p className={`${line} text-muted`}>
          Funded by{" "}
          {payer.sources.map((s, i) => (
            <span key={s.address}>
              {i ? "; " : ""}
              <span className="text-ink">
                {s.label ? entityPhrase(s.label) : s.tags.length ? `“${displayTag(s.tags)}” (explorer tag)` : "an unlabelled wallet"}
              </span>{" "}
              <span className="font-mono tabular-nums">{formatUsdt(s.usdt, { symbol: false })}</span>
            </span>
          ))}
          {payer.partial ? " — among its transfers just before it paid; older ones were not read." : "."}
        </p>
      );
  }
}
