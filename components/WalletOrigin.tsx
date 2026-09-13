"use client";

/**
 * The wallet card — the other half of the question.
 *
 * The trace answers "where did the money go". This answers "what is this
 * address, and who put money into it", which is what an investigator asks the
 * moment they click a node. The headline is deliberately the wallet's **age**:
 * a wallet first seen days before the fraud and funded by unrelated payers is a
 * different object from one that has been settling traffic for three years, and
 * nothing else in the interface was saying which one you were looking at.
 *
 * Every figure here is stated with what limits it. A wallet we could not read
 * says so and shows nothing else; a wallet whose history ran past the page
 * limit marks its first-seen date as a floor rather than a birthday, because a
 * truncated history read as an opening date is exactly how a years-old address
 * gets called freshly created.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatDateTime,
  formatUsdt,
  shortAddress,
  tronscanAddressUrl,
} from "@/lib/format";
import { checkTronAddress } from "@/lib/tron";
import type { WalletProfile, Counterparty } from "@/lib/wallet";
import {
  Chip,
  Designation,
  ErrorState,
  Panel,
  SourceChip,
  Spinner,
  StatCard,
  buttonStyles,
  entityPhrase,
} from "@/components/ui";

const DAY_MS = 86_400_000;
/** The window the NEW_ADDRESS rule uses. Kept in step with lib/risk.ts. */
const FRESH_DAYS = 30;

type State =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; profile: WalletProfile };

export default function WalletOrigin({ address }: { address: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  // Validation is pure and synchronous, so it belongs in render. Setting state
  // for it inside the effect is the cascading-render pattern React 19.2 fails
  // the build on — see the note in CONTEXT.md.
  const check = checkTronAddress(address);

  useEffect(() => {
    if (!check.valid) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/wallet/${encodeURIComponent(address)}`);
        const json = await res.json();
        if (!live) return;
        if (!res.ok) {
          setState({ status: "error", reason: json?.error ?? `HTTP ${res.status}` });
          return;
        }
        setState({ status: "ready", profile: json as WalletProfile });
      } catch (err) {
        if (live) {
          setState({
            status: "error",
            reason: err instanceof Error ? err.message : "The wallet could not be read.",
          });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [address, check.valid]);

  if (!check.valid) {
    return (
      <div className="mt-10">
        <ErrorState
          title="Not a TRON address"
          description={check.reason}
          action={
            <Link href="/investigate" className={buttonStyles.secondary}>
              Trace another address
            </Link>
          }
        />
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mt-10 flex items-center gap-4 border-l-2 border-brass-dim py-6 pl-6">
        <Spinner className="text-brass" />
        <span className="text-sm text-faint">
          Reading {shortAddress(address)} from the chain…
        </span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-10">
        <ErrorState
          title="Not read"
          description={state.reason}
          action={
            <Link href="/investigate" className={buttonStyles.secondary}>
              Trace another address
            </Link>
          }
        />
      </div>
    );
  }

  const p = state.profile;

  if (!p.readable) {
    return (
      <div className="mt-10">
        <ErrorState
          title="The chain did not answer for this wallet"
          description="Nothing is stated about it. An unreadable wallet is not an empty one, and reporting silence as 'no activity' is the one mistake this tool will not make. Try again in a moment."
          action={
            <a
              href={tronscanAddressUrl(p.address)}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles.secondary}
            >
              Open in block explorer
            </a>
          }
        />
      </div>
    );
  }

  // Aged against the moment the chain was read, not the moment this renders:
  // deterministic between server and client, and the honest reference point —
  // the figure means "as at the read", which is what the provenance line says.
  const readAt = new Date(p.provenance.generatedAt).getTime();
  const ageDays =
    p.firstSeen && Number.isFinite(readAt)
      ? Math.floor((readAt - new Date(p.firstSeen).getTime()) / DAY_MS)
      : null;
  // Only a complete history can date a wallet. A truncated one gives a floor.
  const datable = p.historyComplete && ageDays !== null;
  const fresh = datable && ageDays < FRESH_DAYS;

  return (
    <div className="mt-10 space-y-16">
      {/* --------------------------------------------------------- identity */}
      <section>
        <Designation>{p.label ? "Attributed wallet" : "Unlabelled wallet"}</Designation>
        <p className="mt-4 break-all font-mono text-xl leading-tight text-ink md:text-2xl">
          {p.address}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {p.label ? (
            <>
              <Chip tone="brand">{entityPhrase(p.label)}</Chip>
              <SourceChip source={p.label.source} />
              <Chip>confidence {p.label.confidence.toFixed(2)}</Chip>
            </>
          ) : (
            <Chip title="This address is not in the attribution table, the seed list or the sanctions list.">
              No attribution on record
            </Chip>
          )}
          {fresh ? (
            <Chip tone="hot">Opened within {FRESH_DAYS} days</Chip>
          ) : null}
          {!p.historyComplete ? (
            <Chip title="More history than this pass read — the figures below are a floor, not a total.">
              Partial history
            </Chip>
          ) : null}
        </div>
        {p.label?.evidence ? (
          <p className="mt-6 max-w-2xl text-sm leading-6 text-faint">{p.label.evidence}</p>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- figures */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="First seen"
          value={datable ? `${ageDays}` : "—"}
          hint={
            datable
              ? `days ago · ${formatDateTime(p.firstSeen)}`
              : p.firstSeen
                ? `at least ${formatDateTime(p.firstSeen)} — history is longer than one pass`
                : "no transfers read"
          }
          tone={fresh ? "hot" : "default"}
        />
        <StatCard
          label="Received"
          value={formatUsdt(p.receivedUsdt, { symbol: false })}
          hint={`USDT in, across ${p.fundedBy.length === 1 ? "1 payer" : `${p.fundedBy.length} payers`}`}
        />
        <StatCard
          label="Sent on"
          value={formatUsdt(p.sentUsdt, { symbol: false })}
          hint="USDT out"
        />
        <StatCard
          label="Not moved on"
          value={formatUsdt(p.retainedUsdt, { symbol: false })}
          hint="USDT received and never forwarded"
          tone={p.retainedUsdt > 0 ? "warm" : "default"}
        />
      </section>

      {/* --------------------------------------------------------- funders */}
      <Panel
        title="Funded by"
        subtitle="Who put money into this wallet, largest first. This is where it came from."
        framed={false}
      >
        <Parties parties={p.fundedBy} empty="Nothing was paid into this wallet in the history read." />
      </Panel>

      <Panel
        title="Paid out to"
        subtitle="Where this wallet sent money, largest first."
        framed={false}
      >
        <Parties parties={p.paidOut} empty="This wallet has never sent USDT in the history read." />
      </Panel>

      {/* ------------------------------------------------------- provenance */}
      <section className="border-t border-line pt-6">
        <p className="text-xs leading-6 text-faint">
          Read from the chain in {p.provenance.apiCalls}{" "}
          {p.provenance.apiCalls === 1 ? "call" : "calls"} at{" "}
          {formatDateTime(p.provenance.generatedAt)} ·{" "}
          {p.transfers.toLocaleString("en-US")} transfers examined ·{" "}
          {p.provenance.responseHashes.length} response{" "}
          {p.provenance.responseHashes.length === 1 ? "hash" : "hashes"} recorded.
          {p.historyComplete
            ? ""
            : " More history exists than this pass read — either the page limit was reached, or the wallet sent more than it received, which can only mean inflows are missing. The figures above are a floor, and the first-seen date is the oldest transfer read rather than the day the wallet opened."}
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Parties({ parties, empty }: { parties: Counterparty[]; empty: string }) {
  if (!parties.length) {
    return <p className="pt-6 text-sm leading-6 text-faint">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-line-soft pt-2">
      {parties.map((party) => (
        <li key={party.address} className="flex flex-wrap items-start justify-between gap-4 py-5">
          <div className="min-w-0">
            <Link
              href={`/wallet/${encodeURIComponent(party.address)}`}
              className="fx-option-quiet inline-block break-all px-2 py-1 font-mono text-sm text-ink transition hover:text-brass"
            >
              {party.address}
            </Link>
            <p className="mt-2 pl-2 text-xs leading-5 text-faint">
              {party.label ? entityPhrase(party.label) : "Unlabelled wallet"} ·{" "}
              {party.transfers === 1 ? "1 transfer" : `${party.transfers} transfers`} ·{" "}
              first {formatDateTime(party.firstAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-base font-light tabular-nums text-ink">
              {formatUsdt(party.valueUsdt, { symbol: false })}
            </p>
            <p className="font-label text-xs uppercase tracking-[0.2em] text-faint">USDT</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
