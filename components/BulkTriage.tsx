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
 * So: paste the morning's addresses, one per line — or drop the complaint
 * sheet itself (see lib/intake.ts), and each row is traced with its own amount
 * and date and keeps its acknowledgement number all the way to the freeze
 * request. Validation is local and instant (a checksum costs nothing), the
 * traces run one at a time so we keep the pacing the chain client expects, and
 * the register rebuilds itself as each answer lands — CRITICAL first, largest
 * sum first, exactly the order the case register uses. A wallet that fails
 * says why and does not stop the run.
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
import { combinedHref, groupByExchange } from "@/lib/combined";
import { byState } from "@/lib/by-state";
import { findLinks } from "@/lib/links";
import { watchTargetFor } from "@/lib/watch";
import { addWatch } from "@/lib/watchlist";
import LinkGraph from "@/components/LinkGraph";
import BatchCanvas, { BatchViewToggle, type BatchView } from "@/components/BatchCanvas";
import { parseIntake, type IntakeJob, type IntakeRejected } from "@/lib/intake";
import type { TxLookup } from "@/lib/txlookup";
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

/** One complaint: what was given for it, and where its trace has got to. */
type Entry = IntakeJob &
  (
    | { state: "queued" }
    | { state: "running" }
    | { state: "done"; trace: TraceResult; source: DataSource }
    | { state: "failed"; reason: string }
  );

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
  const [rejected, setRejected] = useState<IntakeRejected[]>([]);
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
  // Complaints that ended at the same exchange: one letter to it, not one each.
  const combined = useMemo(
    () => groupByExchange(results.map((r) => ({ trace: r.trace, ack: r.ack }))),
    [results],
  );
  const [view, setView] = useState<BatchView>("flow");
  // The batch by state or union territory, when the sheet named them.
  const byStateRows = useMemo(
    () =>
      byState(
        entries.map((e) => ({
          stateUt: e.stateUt,
          ...(e.state === "done" ? { trace: e.trace } : {}),
          failed: e.state === "failed",
        })),
      ),
    [entries],
  );

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

  const update = useCallback((key: string, next: Entry) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? next : e)));
  }, []);

  function load() {
    const parsed = parseIntake(raw);
    setRejected(parsed.rejected);
    setEntries(parsed.jobs.map((job) => ({ ...job, state: "queued" })));
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
    const queue: IntakeJob[] = entries
      .filter((e) => e.state === "queued")
      .map(({ key, input, kind, ack, amount, fraudDate, stateUt }) => ({ key, input, kind, ack, amount, fraudDate, stateUt }));
    for (const job of queue) {
      if (stop.current) break;
      update(job.key, { ...job, state: "running" });
      setLive({ address: job.input, note: "Queued for the chain" });
      try {
        let address = job.input;
        let amount = job.amount;
        let fraudDate = job.fraudDate;
        // A complaint that holds a transaction: trace the wallet it paid, from
        // the moment it paid, for what it paid - unless the row says otherwise.
        if (job.kind === "tx") {
          setLive({ address: job.input, note: "Reading the transaction" });
          const res = await fetch(`/api/tx/${encodeURIComponent(job.input)}`);
          const tx = (await res.json()) as TxLookup;
          if (tx.status !== "resolved") {
            update(job.key, { ...job, state: "failed", reason: tx.reason });
            continue;
          }
          address = tx.transfer.to;
          amount ??= tx.transfer.valueUsdt;
          fraudDate ??= new Date(Date.parse(tx.transfer.timestamp) - 1000).toISOString();
        }
        const lookup = await runTrace(
          {
            address,
            ...(amount !== undefined ? { amount } : {}),
            ...(fraudDate ? { fraudDate } : {}),
          },
          (event) => setLive({ address, note: describeProgress(event) }),
        );
        if (lookup.status === "resolved") {
          const target = watchTargetFor(lookup.data);
          if (target) addWatch(target);
          update(job.key, { ...job, state: "done", trace: lookup.data, source: lookup.source });
        } else if (lookup.status === "invalid") {
          update(job.key, { ...job, state: "failed", reason: lookup.reason });
        } else {
          update(job.key, { ...job, state: "failed", reason: lookup.detail });
        }
      } catch (err) {
        update(job.key, {
          ...job,
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
      [
        "ncrp_acknowledgement",
        "state_ut",
        "given",
        "traced_wallet",
        "status",
        "traced_usdt",
        "fraud_date_utc",
        "exit",
        "deposit_address",
        "reason",
      ],
      ...results.map((e) => [
        e.ack ?? "",
        e.stateUt ?? "",
        e.input,
        e.trace.inputAddress,
        TRIAGE_META[e.trace.triage].label,
        e.trace.reportedAmountUsdt.toFixed(2),
        e.trace.fraudDate,
        e.trace.terminal ? entityPhrase(e.trace.terminal.label) : "",
        e.trace.terminal?.depositAddress ?? "",
        e.trace.triageReason,
      ]),
      // Unread complaints stay on the worklist, marked, never dropped.
      ...failed.map((e) => [e.ack ?? "", e.stateUt ?? "", e.input, "", "NOT READ", "", "", "", "", e.reason]),
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
              TRON or Ethereum wallet addresses, one per line, or a complaint sheet
            </label>
            <textarea
              id="bulk"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              rows={10}
              placeholder={"TXY9...\n0x4D24...\none address per line"}
              className="fx-option block w-full resize-y border border-line bg-surface-2 [--fx-face:var(--color-surface-2)] p-4 font-mono text-xs leading-6 text-ink placeholder:text-dim focus:outline-none"
            />
            <p className="mt-4 text-xs leading-5 text-faint">
              One address or transaction per line — or a complaint sheet with a
              header row (acknowledgement number, wallet or transaction, amount,
              date, state), and each complaint keeps its number to the freeze request.
              Everything is checksum-checked before any chain read.{" "}
              <a
                href="/templates/complaint-sheet-example.csv"
                download
                className="fx-option-quiet px-1 align-baseline text-muted underline-offset-4 hover:text-brass"
              >
                Example sheet
              </a>
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

        {byStateRows.length && entries.some((e) => e.stateUt) ? (
          <Panel
            title="By state"
            subtitle="The same complaints, counted by state or union territory from the sheet — which states' money can still be reached, and where it went."
            framed={false}
          >
            <div className="fx-scroll min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-label text-xs uppercase tracking-[0.16em] text-faint">
                    <th className="py-2 pr-4 font-normal">State / UT</th>
                    <th className="py-2 pr-4 text-right font-normal">Complaints</th>
                    <th className="py-2 pr-4 text-right font-normal">Critical</th>
                    <th className="py-2 pr-4 text-right font-normal">At an exchange</th>
                    <th className="py-2 pr-4 text-right font-normal">Closed</th>
                    <th className="py-2 pr-4 text-right font-normal">Not read</th>
                    <th className="py-2 pr-4 text-right font-normal">USDT still reachable</th>
                    <th className="py-2 font-normal">Exchanges reached</th>
                  </tr>
                </thead>
                <tbody>
                  {byStateRows.map((row) => (
                    <tr key={row.stateUt} className="border-b border-line-soft">
                      <td className="py-2 pr-4 text-ink">{row.stateUt}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-ink">{row.complaints}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-critical">{row.critical}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-suspicious">{row.reachedExchange}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted">{row.closed}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-faint">{row.notRead}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-ink">
                        {formatUsdt(row.reachableUsdt, { symbol: false })}
                      </td>
                      <td className="py-2 text-xs text-muted">
                        {row.exchanges.length
                          ? row.exchanges.map((x) => `${x.entity} ${x.complaints}`).join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}

        {combined.length ? (
          <Panel
            title="One request per exchange"
            subtitle="Complaints whose money reached the same exchange, in one letter to it."
            framed={false}
          >
            <ul className="divide-y divide-line">
              {combined.map((group) => {
                const accounts = new Set(group.entries.map((e) => e.trace.terminal!.address));
                const usdt = group.entries.reduce((sum, e) => {
                  const exit = e.trace.terminal!.address;
                  return sum + (e.trace.nodes.find((n) => n.address === exit)?.taintedValueUsdt ?? 0);
                }, 0);
                return (
                  <li key={group.entity} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{group.entity}</p>
                      <p className="mt-1 text-xs leading-5 text-faint">
                        {group.entries.length} complaints ·{" "}
                        {accounts.size === 1 ? "1 account" : `${accounts.size} accounts`} ·{" "}
                        {formatUsdt(usdt, { symbol: false })} USDT
                      </p>
                    </div>
                    <Link
                      href={combinedHref(group.entity, group.entries)}
                      className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
                    >
                      Combined request
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
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
                <ResultRow
                  key={entry.key}
                  trace={entry.trace}
                  source={entry.source}
                  ack={entry.ack}
                  stateUt={entry.stateUt}
                  fromTx={entry.kind === "tx" ? entry.input : undefined}
                />
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
                <li key={e.key}>
                  <Chip tone={e.state === "running" ? "brand" : "neutral"}>
                    {/* Chips are uppercase; an address is not. Base58 is
                        case-sensitive and an upper-cased one is a wrong one. */}
                    <span className="font-mono normal-case tracking-normal">
                      {e.ack ? `${e.ack} · ` : ""}
                      {shortAddress(e.input)}
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
                <li key={e.key} className="border-l border-line pl-4">
                  <p className="break-all font-mono text-xs text-muted">
                    {e.ack ? `${e.ack} · ` : ""}
                    {e.input}
                  </p>
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

function ResultRow({
  trace,
  source,
  ack,
  stateUt,
  fromTx,
}: {
  trace: TraceResult;
  source: DataSource;
  /** The complaint's acknowledgement number, from a complaint sheet. */
  ack?: string;
  /** Its state or union territory, from the sheet. */
  stateUt?: string;
  /** The transaction the complaint gave, when it gave one instead of a wallet. */
  fromTx?: string;
}) {
  const exit = trace.terminal;
  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TriageBadge level={trace.triage} />
            {source === "demo" ? <Chip tone="brand">Recorded</Chip> : null}
            {source === "illustrative" ? <Chip>Illustrative</Chip> : null}
            {ack ? (
              <Chip>
                <span className="font-mono normal-case tracking-normal">NCRP {ack}</span>
              </Chip>
            ) : null}
            {stateUt ? <Chip>{stateUt}</Chip> : null}
          </div>
          <p className="mt-4 break-all font-mono text-sm text-ink">{trace.inputAddress}</p>
          {fromTx ? (
            <p className="mt-1 break-all font-mono text-xs text-faint">
              paid by transaction {shortAddress(fromTx, 10, 8)}
            </p>
          ) : null}
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
        <Link href={traceHref("trace", trace, ack)} className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass">
          Open the trace
        </Link>
        {freezable(trace) ? (
          <Link
            href={traceHref("freeze", trace, ack)}
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
