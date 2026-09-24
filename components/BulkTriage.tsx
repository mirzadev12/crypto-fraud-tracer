"use client";

/**
 * Bulk triage — the screen the single-trace screen implies.
 *
 * One complaint at a time is a demo. A day at I4C is a few hundred complaints
 * arriving overnight, and the question that matters at 9am is not "what
 * happened to this wallet" but "which of these still have money we can reach
 * before lunch". That is the claim the whole product is built on, and until now
 * nothing on screen actually performed it.
 *
 * So: paste the morning's addresses, one per line. Validation is local and
 * instant (base58check costs nothing), the traces run one at a time so we keep
 * the pacing the chain client expects, and the register rebuilds itself as each
 * answer lands — CRITICAL first, largest sum first, exactly the order the case
 * register uses. A wallet that fails says why and does not stop the run.
 */

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  freezable,
  runTrace,
  traceHref,
  type DataSource,
  type TraceProgress,
} from "@/lib/api";
import { count, formatUsdt, shortAddress } from "@/lib/format";
import { findLinks } from "@/lib/links";
import { watchTargetFor } from "@/lib/watch";
import { addWatch } from "@/lib/watchlist";
import LinkGraph from "@/components/LinkGraph";
import BatchCanvas, { BatchViewToggle, type BatchView } from "@/components/BatchCanvas";
import { checkTronAddress } from "@/lib/tron";
import { identifyChain } from "@/lib/chains";
import type { TraceResult, TriageLevel } from "@/lib/types";
import {
  Chip,
  Designation,
  EmptyState,
  Panel,
  Spinner,
  StatCard,
  TriageBadge,
  TRIAGE_META,
  buttonStyles,
  entityPhrase,
} from "@/components/ui";

/* ------------------------------------------------------------------ model */

type Entry =
  | { address: string; state: "queued" }
  | { address: string; state: "running" }
  | { address: string; state: "done"; trace: TraceResult; source: DataSource }
  | { address: string; state: "failed"; reason: string };

interface Rejected {
  line: string;
  reason: string;
}

/** The register's order, and for the same reason: worth the next hour first. */
const RANK: Record<TriageLevel, number> = { HOT: 0, WARM: 1, COLD: 2 };

type Traced = Extract<Entry, { state: "done" }>;

function sortResults(entries: Entry[]): Traced[] {
  const done = entries.filter((e): e is Traced => e.state === "done");
  done.sort((a, b) => {
    const rank = RANK[a.trace.triage] - RANK[b.trace.triage];
    if (rank !== 0) return rank;
    return b.trace.reportedAmountUsdt - a.trace.reportedAmountUsdt;
  });
  return done;
}

/** Split on anything a pasted column, a CSV or a typed list can put between addresses. */
function parseAddresses(raw: string): { queued: string[]; rejected: Rejected[] } {
  const seen = new Set<string>();
  const queued: string[] = [];
  const rejected: Rejected[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const candidate = token.trim();
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const check = checkTronAddress(candidate);
    if (check.valid) {
      queued.push(candidate);
      continue;
    }
    // Another chain's address is not a typo; say what it is and where it can go.
    const other = identifyChain(candidate);
    rejected.push({
      line: candidate,
      reason: other
        ? `${other.chain.name} address — traced on TRON only. Screen it against OFAC from New case.`
        : check.reason,
    });
  }
  return { queued, rejected };
}

/** One line of real telemetry, worded for someone watching a list run. */
function describeProgress(event: TraceProgress): string {
  switch (event.type) {
    case "start":
      return "Opening the window";
    case "window":
      return `Window opens ${event.since.slice(0, 10)}`;
    case "hop":
      return `Hop ${event.depth} — ${event.wallets} wallet${event.wallets === 1 ? "" : "s"}`;
    case "read":
      return `Read ${shortAddress(event.address)} — ${event.transfers} transfer${
        event.transfers === 1 ? "" : "s"
      }`;
    case "label":
      return `Attribution matched — ${event.entity}`;
    case "scoring":
      return `Scoring ${count(event.wallets, "wallet")}`;
    case "recorded":
      return `Recorded case ${event.caseId}`;
  }
}

/* ------------------------------------------------------------------ screen */

export default function BulkTriage({ sample }: { sample: string[] }) {
  const [raw, setRaw] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<{ address: string; note: string } | null>(null);
  const stop = useRef(false);

  const results = useMemo(() => sortResults(entries), [entries]);
  const pending = entries.filter((e) => e.state === "queued" || e.state === "running");
  const failed = entries.filter(
    (e): e is Extract<Entry, { state: "failed" }> => e.state === "failed",
  );

  /*
   * The question a cyber cell asks straight after triage: are any of these the
   * same people. Computed from results already in hand — no extra chain read.
   */
  const links = useMemo(() => findLinks(results.map((r) => r.trace)), [results]);
  const [view, setView] = useState<BatchView>("flow");

  const stats = useMemo(() => {
    let critical = 0;
    let reachable = 0;
    const entities = new Set<string>();
    for (const entry of results) {
      if (entry.trace.triage === "HOT") critical++;
      if (entry.trace.triage !== "COLD") reachable += entry.trace.reportedAmountUsdt;
      if (entry.trace.terminal) entities.add(entry.trace.terminal.label.entity);
    }
    return { critical, reachable, entities: entities.size };
  }, [results]);

  const update = useCallback((address: string, next: Entry) => {
    setEntries((prev) => prev.map((e) => (e.address === address ? next : e)));
  }, []);

  function load() {
    const parsed = parseAddresses(raw);
    setRejected(parsed.rejected);
    setEntries(parsed.queued.map((address) => ({ address, state: "queued" })));
    setLive(null);
  }

  async function onFile(file: File) {
    const text = await file.text();
    setRaw((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }

  /*
   * Sequential on purpose. The chain client paces itself and a parallel fan-out
   * would simply collect 429s — and an unreadable wallet is the one thing this
   * tool must never report as an empty one.
   */
  async function run() {
    stop.current = false;
    setRunning(true);
    const queue = entries.filter((e) => e.state === "queued").map((e) => e.address);
    for (const address of queue) {
      if (stop.current) break;
      update(address, { address, state: "running" });
      setLive({ address, note: "Queued for the chain" });
      try {
        const lookup = await runTrace({ address }, (event) =>
          setLive({ address, note: describeProgress(event) }),
        );
        if (lookup.status === "resolved") {
          const target = watchTargetFor(lookup.data);
          if (target) addWatch(target);
          update(address, {
            address,
            state: "done",
            trace: lookup.data,
            source: lookup.source,
          });
        } else if (lookup.status === "invalid") {
          update(address, { address, state: "failed", reason: lookup.reason });
        } else {
          update(address, { address, state: "failed", reason: lookup.detail });
        }
      } catch (err) {
        update(address, {
          address,
          state: "failed",
          reason: err instanceof Error ? err.message : "The trace could not be completed.",
        });
      }
    }
    setLive(null);
    setRunning(false);
  }

  /** The morning's worklist, as a file an officer can file or forward. */
  function exportCsv() {
    const rows = [
      ["address", "status", "reported_usdt", "exit", "deposit_address", "reason"],
      ...results.map((e) => [
        e.trace.inputAddress,
        TRIAGE_META[e.trace.triage].label,
        e.trace.reportedAmountUsdt.toFixed(2),
        e.trace.terminal ? entityPhrase(e.trace.terminal.label) : "",
        e.trace.terminal?.depositAddress ?? "",
        e.trace.triageReason,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `finex-triage-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const traced = results.length;
  const total = entries.length;

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* ------------------------------------------------------------ intake */}
      <div className="min-w-0 space-y-6">
        <Panel title="The morning's addresses" framed={false}>
          <div className="pt-4">
            <label htmlFor="bulk" className="sr-only">
              TRON wallet addresses, one per line
            </label>
            <textarea
              id="bulk"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              rows={10}
              placeholder={"TXY9...\nTS27...\none address per line"}
              className="fx-option block w-full resize-y border border-line bg-surface-2 [--fx-face:var(--color-surface-2)] p-4 font-mono text-xs leading-6 text-ink placeholder:text-dim focus:outline-none"
            />
            <p className="mt-4 text-xs leading-5 text-faint">
              One per line — commas and semicolons work too. Each address is
              checksum-checked before any chain read; duplicates are dropped.
            </p>

            {/* One column, one width: the primary, then the two ways to fill
                the box. In a 20rem row they wrapped onto three lines with three
                different indents. */}
            <div className="mt-6 flex flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={load}
                disabled={running || !raw.trim()}
                className={buttonStyles.primary}
              >
                Build the queue
              </button>
              <button
                type="button"
                onClick={() => setRaw(sample.join(String.fromCharCode(10)))}
                disabled={running}
                title={`The ${sample.length} wallets already captured from the chain for this build — real addresses, so a run here is a real run.`}
                className={buttonStyles.ghost}
              >
                Load the {sample.length} recorded cases
              </button>
              <label className="fx-option-quiet inline-flex cursor-pointer items-center justify-center px-4 py-4 font-label text-xs font-semibold uppercase tracking-[0.2em] text-faint transition hover:text-brass">
                Load a file
                <input
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </Panel>

        {rejected.length ? (
          <Panel title={`${rejected.length} not queued`} framed={false}>
            <ul className="space-y-4 pt-4">
              {rejected.map((r) => (
                <li key={r.line} className="border-l border-critical-deep pl-4">
                  <p className="break-all font-mono text-xs text-muted">{r.line}</p>
                  <p className="mt-1 text-xs leading-5 text-faint">{r.reason}</p>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {total ? (
          <Panel title="Run" framed={false}>
            <div className="pt-4">
              <p className="font-mono text-sm text-ink">
                {traced} of {total} traced
                {failed.length ? ` · ${failed.length} unreadable` : ""}
              </p>
              <div className="mt-4 h-px w-full bg-line">
                <div
                  className="h-px bg-brass transition-all"
                  style={{ width: `${total ? ((traced + failed.length) / total) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {running ? (
                  <button
                    type="button"
                    onClick={() => {
                      stop.current = true;
                    }}
                    className={buttonStyles.secondary}
                  >
                    Stop after this one
                  </button>
                ) : pending.length ? (
                  <button
                    type="button"
                    onClick={() => void run()}
                    className={buttonStyles.primary}
                  >
                    {traced || failed.length ? "Resume" : "Run the queue"}
                  </button>
                ) : null}
                {traced ? (
                  <button type="button" onClick={exportCsv} className={buttonStyles.ghost}>
                    Export CSV
                  </button>
                ) : null}
              </div>
              <p className="mt-6 text-xs leading-5 text-faint">
                Traces run one at a time so the chain is read at a pace it will answer.
                A long list is minutes, not seconds; results are usable as they land and
                stopping keeps everything already traced.
              </p>
            </div>
          </Panel>
        ) : null}
      </div>

      {/* ----------------------------------------------------------- register */}
      <div className="min-w-0 space-y-10">
        {live ? (
          <div className="flex flex-wrap items-center gap-4 border-l-2 border-brass-dim py-4 pl-4">
            <Spinner className="text-brass" />
            <span className="font-mono text-xs text-ink">{shortAddress(live.address)}</span>
            <span className="text-xs text-faint">{live.note}</span>
          </div>
        ) : null}

        {traced ? (
          <>
            {/*
              One line summarising the morning. It exists because the product's
              whole claim — "we tell you which of today's complaints still have
              money" — had no single place that said it, and a reader (or a
              camera) needs one frame that does.
            */}
            <p className="border-l-2 border-brass-dim py-4 pl-6 text-sm leading-7 text-muted">
              <strong className="font-semibold text-ink">{traced}</strong>{" "}
              {traced === 1 ? "complaint" : "complaints"} traced ·{" "}
              <strong className="font-semibold text-ink">{stats.critical}</strong> still
              holding funds ·{" "}
              <strong className="font-semibold text-ink">
                {formatUsdt(stats.reachable, { symbol: false })} USDT
              </strong>{" "}
              still reachable
              {links.length ? (
                <>
                  {" · "}
                  <strong className="font-semibold text-brass">
                    {links.length === 1 ? "1 shared account" : `${links.length} shared accounts`}
                  </strong>
                </>
              ) : null}
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <StatCard
              label="Act now"
              value={String(stats.critical)}
              hint="Funds still at rest"
              tone={stats.critical ? "hot" : "default"}
            />
            <StatCard
              label="Still reachable"
              value={formatUsdt(stats.reachable, { symbol: false })}
              hint="USDT on cases not yet closed"
            />
            <StatCard
              label="Exits named"
              value={String(stats.entities)}
              hint="Distinct services reached"
            />
            </div>
          </>
        ) : null}

        {/* The batch as one picture, before the register lists it as rows.
            `LinkGraph` below answers "which complaints are the same case"; this
            answers the wider question the register cannot — where the morning's
            money went, hop by hop, and which wallets the trails share. A ringed
            wallet here is one `findLinks` returned, so the drawing and the link
            panel can never disagree. */}
        {traced > 1 ? (
          <Panel
            title="The morning, drawn"
            subtitle="Every wallet these complaints touched. A ringed wallet is one more than one of them reached."
            actions={<BatchViewToggle view={view} onChange={setView} />}
            bodyClassName=""
          >
            <BatchCanvas traces={results.map((e) => e.trace)} view={view} />
          </Panel>
        ) : null}

        <Panel
          title="Triaged"
          subtitle="Most to least suspicious, largest sum at stake first."
          framed={false}
        >
          {traced ? (
            <ul className="divide-y divide-line">
              {results.map((entry) => (
                <ResultRow key={entry.address} trace={entry.trace} source={entry.source} />
              ))}
            </ul>
          ) : (
            <div className="pt-4">
              <EmptyState
                title="Nothing traced yet"
                description="Paste the addresses from today's complaints and run the queue. Each one is traced on the chain in turn, and this register reorders itself as answers land — the case with money still sitting somewhere rises to the top on its own."
              />
            </div>
          )}
        </Panel>

        {links.length ? (
          <Panel
            title={`${links.length === 1 ? "1 shared wallet" : `${links.length} shared wallets`}`}
            subtitle="Complaints that ran through the same account. Shared exchanges and mixers are not counted — those are used by everyone."
            framed={false}
          >
            <ul className="divide-y divide-line pt-2">
              {links.map((link) => (
                <li key={link.address} className="py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-brass">
                      {link.cases.length} complaints · one wallet
                    </p>
                    <p className="font-mono text-sm tabular-nums text-ink">
                      {formatUsdt(link.totalUsdt, { symbol: false })}{" "}
                      <span className="text-xs text-faint">USDT converged</span>
                    </p>
                  </div>
                  <Link
                    href={`/wallet/${encodeURIComponent(link.address)}`}
                    className="fx-option-quiet mt-2 inline-block break-all px-2 py-1 font-mono text-sm text-ink transition hover:text-brass"
                  >
                    {link.address}
                  </Link>
                  {/* The shape, not just the sentence: separate victims, one
                      account. The graph carries the case links itself, so the
                      chip row it used to duplicate is gone. */}
                  <LinkGraph link={link} />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {pending.length ? (
          <Panel title={`${pending.length} waiting`} framed={false}>
            <ul className="flex flex-wrap gap-2 pt-4">
              {pending.map((e) => (
                <li key={e.address}>
                  <Chip tone={e.state === "running" ? "brand" : "neutral"}>
                    {/* Chips are uppercase; an address is not. Base58 is
                        case-sensitive and an upper-cased one is a wrong one. */}
                    <span className="font-mono normal-case tracking-normal">
                      {shortAddress(e.address)}
                    </span>
                  </Chip>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {failed.length ? (
          <Panel
            title={`${failed.length} unreadable`}
            subtitle="Stated rather than scored. An unreadable wallet is not an empty one."
            framed={false}
          >
            <ul className="space-y-4 pt-4">
              {failed.map((e) => (
                <li key={e.address} className="border-l border-line pl-4">
                  <p className="break-all font-mono text-xs text-muted">{e.address}</p>
                  <p className="mt-1 text-xs leading-5 text-faint">{e.reason}</p>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- row */

function ResultRow({ trace, source }: { trace: TraceResult; source: DataSource }) {
  const exit = trace.terminal;
  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TriageBadge level={trace.triage} />
            {source === "demo" ? <Chip tone="brand">Recorded</Chip> : null}
            {source === "illustrative" ? <Chip>Illustrative</Chip> : null}
          </div>
          <p className="mt-4 break-all font-mono text-sm text-ink">{trace.inputAddress}</p>
          <p className="mt-2 max-w-xl text-xs leading-5 text-faint">{trace.triageReason}</p>
        </div>
        <div className="shrink-0 text-right">
          <Designation>Traced</Designation>
          <p className="mt-2 font-mono text-lg font-light tabular-nums text-ink">
            {formatUsdt(trace.reportedAmountUsdt, { symbol: false })}
          </p>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-faint">USDT</p>
        </div>
      </div>

      {exit ? (
        <div className="mt-4 border-l border-brass-dim pl-4">
          <Designation>{entityPhrase(exit.label)}</Designation>
          {exit.depositAddress ? (
            <p className="mt-2 break-all font-mono text-sm text-brass">
              {exit.depositAddress}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={traceHref("trace", trace)} className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass">
          Open the trace
        </Link>
        {freezable(trace) ? (
          <Link
            href={traceHref("freeze", trace)}
            className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
          >
            Freeze request
          </Link>
        ) : null}
        {trace.riskFlags.length ? (
          <Chip tone={trace.triage === "HOT" ? "hot" : "neutral"}>
            {trace.riskFlags.length} signal{trace.riskFlags.length === 1 ? "" : "s"}
          </Chip>
        ) : null}
      </div>
    </li>
  );
}
