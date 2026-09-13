"use client";

/**
 * The derivation, on screen.
 *
 * AGENTS.md §7 says the deliverable of the clustering work is a number we can
 * quote, and §15 says the answer to "where do your exchange labels come from"
 * is "explorer tags as ground truth, expanded by sweep-pattern clustering".
 * Until now both were assertions: the number sat on the landing page and the
 * evidence sat in a JSON file nobody opens.
 *
 * This screen is the exhibit. Every derived address, the seed it was derived
 * from, how many sweeps were observed and what share of its inflow it forwarded
 * — searchable, and each row one click from the public explorer so the claim
 * can be checked rather than believed. Showing the working is the point: a
 * dataset an evaluator can audit reads as a stronger claim than a bigger one
 * they cannot.
 */

import { useMemo, useState } from "react";
import { shortAddress, tronscanAddressUrl } from "@/lib/format";
import { Designation, Panel, SourceChip } from "@/components/ui";

export interface DerivedRow {
  address: string;
  exchange: string;
  sweepCount: number;
  confidence: number;
  evidence: string;
  hotWallet: string;
  windowTruncated: boolean;
}

export interface SeedRow {
  address: string;
  exchange: string;
  tag: string;
  source_url: string;
}

type Sort = "confidence" | "sweeps" | "exchange";

const SORTS: ReadonlyArray<{ key: Sort; label: string }> = [
  { key: "confidence", label: "Confidence" },
  { key: "sweeps", label: "Sweeps" },
  { key: "exchange", label: "Exchange" },
];

export default function AttributionRegister({
  rows,
  seeds,
}: {
  rows: DerivedRow[];
  seeds: SeedRow[];
}) {
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("confidence");

  const exchanges = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.exchange, (counts.get(row.exchange) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (exchange && row.exchange !== exchange) return false;
      if (!needle) return true;
      return (
        row.address.toLowerCase().includes(needle) ||
        row.exchange.toLowerCase().includes(needle) ||
        row.hotWallet.toLowerCase().includes(needle)
      );
    });
    filtered.sort((a, b) => {
      if (sort === "sweeps") return b.sweepCount - a.sweepCount;
      if (sort === "exchange") return a.exchange.localeCompare(b.exchange);
      return b.confidence - a.confidence;
    });
    return filtered;
  }, [rows, query, exchange, sort]);

  /** The seed a derived row was swept into, so the row can name its own source. */
  const seedTag = useMemo(() => {
    const map = new Map<string, string>();
    for (const seed of seeds) map.set(seed.address, seed.tag);
    return map;
  }, [seeds]);

  return (
    <div className="mt-10 space-y-16">
      {/* ------------------------------------------------------------- seeds */}
      <Panel
        title="Ground truth — the seeds"
        subtitle="Exchange wallets carrying a public block-explorer tag. Treated as fact, and the only thing in this pipeline that is."
        framed={false}
      >
        <div className="overflow-x-auto pt-6">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <Th>Tag</Th>
                <Th>Exchange</Th>
                <Th>Address</Th>
                <Th>Derived from it</Th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => {
                const derived = rows.filter((r) => r.hotWallet === seed.address).length;
                return (
                  <tr key={seed.address} className="border-b border-line-soft">
                    <Td>
                      <span className="font-label text-xs uppercase tracking-[0.16em] text-ink">
                        {seed.tag}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-muted">{seed.exchange}</span>
                    </Td>
                    <Td>
                      <a
                        href={tronscanAddressUrl(seed.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="fx-option-quiet px-2 py-1 font-mono text-xs text-faint transition hover:text-brass"
                      >
                        {shortAddress(seed.address, 10, 8)}
                      </a>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm tabular-nums text-ink">
                        {derived}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
          Each address above was read back from the chain and its tag re-checked
          against a public explorer before it was used as a seed. The link opens
          the explorer so the tag can be confirmed independently.
        </p>
      </Panel>

      {/* ----------------------------------------------------------- derived */}
      <Panel
        title={`Derived — ${rows.length} customer deposit addresses`}
        subtitle="Heuristic. An address that repeatedly receives from unrelated senders and forwards almost all of it to one tagged exchange wallet is that exchange's customer deposit address."
        framed={false}
        actions={<SourceChip source="heuristic" />}
      >
        <div className="pt-6">
          {/* ------------------------------------------------------- controls */}
          <div className="flex flex-wrap items-end gap-6">
            <div className="min-w-0 grow">
              <label htmlFor="q" className="block">
                <Designation>Search address or exchange</Designation>
              </label>
              <input
                id="q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                placeholder="TSu8w…  ·  Bybit"
                className="fx-option mt-3 block w-full border border-line bg-surface-2 px-4 py-3 font-mono text-xs text-ink placeholder:text-dim focus:outline-none"
              />
            </div>
            <div>
              <Designation>Order by</Designation>
              <div className="mt-3 flex flex-wrap gap-2">
                {SORTS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSort(option.key)}
                    aria-pressed={sort === option.key}
                    className={`px-4 py-3 font-label text-xs uppercase tracking-[0.16em] transition ${
                      sort === option.key
                        ? "fx-option-on text-brass"
                        : "fx-option-quiet text-faint hover:text-brass"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExchange(null)}
              aria-pressed={exchange === null}
              className={`px-3 py-2 font-label text-xs uppercase tracking-[0.16em] transition ${
                exchange === null
                  ? "fx-option-on text-brass"
                  : "fx-option-quiet text-faint hover:text-brass"
              }`}
            >
              All {rows.length}
            </button>
            {exchanges.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setExchange(name === exchange ? null : name)}
                aria-pressed={exchange === name}
                className={`px-3 py-2 font-label text-xs uppercase tracking-[0.16em] transition ${
                  exchange === name
                    ? "fx-option-on text-brass"
                    : "fx-option-quiet text-faint hover:text-brass"
                }`}
              >
                {name} {count}
              </button>
            ))}
          </div>

          {/* ---------------------------------------------------------- table */}
          <div className="mt-10 max-h-[34rem] overflow-auto border border-line">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-line">
                  <Th>Deposit address</Th>
                  <Th>Exchange</Th>
                  <Th numeric>Sweeps</Th>
                  <Th numeric>Confidence</Th>
                  <Th>Evidence</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.address} className="border-b border-line-soft align-top">
                    <Td>
                      <a
                        href={tronscanAddressUrl(row.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="fx-option-quiet block px-2 py-1 font-mono text-xs text-ink transition hover:text-brass"
                      >
                        {row.address}
                      </a>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-sm text-muted">
                        {row.exchange}
                      </span>
                      {/* The seed it was swept into. Suppressed when the
                          explorer tag is just the exchange name again. */}
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                        {seedTag.get(row.hotWallet)?.toLowerCase() === row.exchange.toLowerCase()
                          ? shortAddress(row.hotWallet)
                          : (seedTag.get(row.hotWallet) ?? shortAddress(row.hotWallet))}
                      </span>
                    </Td>
                    <Td numeric>
                      <span className="font-mono text-sm tabular-nums text-ink">
                        {row.sweepCount}
                      </span>
                    </Td>
                    <Td numeric>
                      <span
                        className={`font-mono text-sm tabular-nums ${
                          row.confidence >= 0.8 ? "text-ink" : "text-faint"
                        }`}
                      >
                        {row.confidence.toFixed(2)}
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-md text-xs leading-5 text-faint">
                        {row.evidence}
                      </span>
                      {row.windowTruncated ? (
                        <span className="mt-2 inline-block font-label text-[10px] uppercase tracking-[0.14em] text-dim">
                          Partial window — the true sweep count is at least this
                        </span>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 font-mono text-xs text-faint">
            {shown.length} of {rows.length} shown
          </p>
        </div>
      </Panel>

      {/* --------------------------------------------------------- the method */}
      <Panel title="How a row gets here" framed={false}>
        <div className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6 text-sm leading-7 text-muted">
            <p>
              An exchange gives every customer a unique address to deposit to,
              then sweeps those balances into its own hot wallet. That habit is
              visible on a public chain, and it is the whole derivation.
            </p>
            <p>
              For each tagged hot wallet we read who paid into it, cap the list
              at the first 30 distinct senders, and read each sender&apos;s own
              transfers. A sender qualifies when it has swept to that hot wallet{" "}
              <strong className="font-semibold text-ink">at least twice</strong> and
              has forwarded{" "}
              <strong className="font-semibold text-ink">
                90% or more of everything it ever received
              </strong>{" "}
              to it. Confidence rises with the sweep count and is capped at 0.95.
              Nothing here is ever 1.00.
            </p>
            <p>
              It runs offline, once, on a laptop. The output is committed and
              read from a file, so no part of a live trace depends on it being
              rebuilt.
            </p>
          </div>
          <div className="min-w-0 space-y-8">
            <Fact
              label="What this is not"
              body="An account name. A deposit cluster identifies the exchange holding the account, not the person behind it — that mapping exists only inside the exchange, which is exactly why a freeze request has to be sent to them."
            />
            <Fact
              label="Where it is wrong"
              body="A merchant settling everything to one exchange looks identical to a customer deposit address. The 90% threshold and the two-sweep minimum cut most of those, and the confidence figure carries the rest of the doubt rather than hiding it."
            />
            <Fact
              label="Why the cap stays"
              body="Thirty senders per seed is not a limit of the method, it is a limit of one laptop and a public API without a key. The rule is unchanged at any scale; only the row count moves."
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Th({ children, numeric = false }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-faint ${
        numeric ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric = false }: { children: React.ReactNode; numeric?: boolean }) {
  return <td className={`px-3 py-4 ${numeric ? "text-right" : "text-left"}`}>{children}</td>;
}

function Fact({ label, body }: { label: string; body: string }) {
  return (
    <div className="border-l border-line pl-6">
      <Designation>{label}</Designation>
      <p className="mt-3 text-sm leading-6 text-faint">{body}</p>
    </div>
  );
}
