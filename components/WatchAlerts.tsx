"use client";

/**
 * Alerts on the desk: has money we found at rest started to move?
 *
 * The desk is where an officer starts the day, so that is where the check runs —
 * when the desk opens, and again every five minutes while it stays open. That
 * is the honest shape of "automated" on a deployment with no database and no
 * process that stays awake: it runs without anyone asking, for as long as the
 * desk is open, and the screen says exactly that.
 *
 * Loading state follows the pattern in `TraceLoader`: a report is tagged with
 * the watch list it was produced for, and "checking" is derived from a mismatch
 * rather than set synchronously in an effect.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime, formatUsdt, shortAddress } from "@/lib/format";
import type { WatchItem, WatchResult } from "@/lib/watch";
import { removeWatch, useWatchlist } from "@/lib/watchlist";
import { Panel, buttonStyles } from "@/components/ui";

const EVERY_MS = 5 * 60 * 1000;

interface Report {
  forKey: string;
  checkedAt: string;
  results: Map<string, WatchResult>;
  /** Set when the check request itself failed — nothing is stated then. */
  failure?: string;
}

function keyOf(items: WatchItem[]): string {
  return items.map((i) => `${i.address}@${i.since}`).join("|");
}

export default function WatchAlerts() {
  const items = useWatchlist();
  const key = useMemo(() => keyOf(items), [items]);
  const [report, setReport] = useState<Report | null>(null);

  // Ask the route and describe the answer. Pure of React state: it returns the
  // report, and callers set it from a promise callback — never synchronously in
  // an effect body, which the React 19.2 lint rule rejects.
  const check = useCallback(async (list: WatchItem[], forKey: string): Promise<Report> => {
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: list.map(({ address, since }) => ({ address, since })) }),
      });
      const json = (await res.json()) as {
        checkedAt?: string;
        results?: WatchResult[];
        error?: string;
      };
      if (!res.ok || !json.results || !json.checkedAt) {
        return {
          forKey,
          checkedAt: json.checkedAt ?? "",
          results: new Map(),
          failure: json.error ?? `the check did not complete (HTTP ${res.status})`,
        };
      }
      return {
        forKey,
        checkedAt: json.checkedAt,
        results: new Map(json.results.map((r) => [r.address, r])),
      };
    } catch (err) {
      return {
        forKey,
        checkedAt: "",
        results: new Map(),
        failure: err instanceof Error ? err.message : "the check did not complete",
      };
    }
  }, []);

  // When the desk opens, whenever the list changes, and on a timer while open.
  useEffect(() => {
    if (!items.length) return;
    let live = true;
    const run = () =>
      check(items, key).then((next) => {
        if (live) setReport(next);
      });
    void run();
    const timer = window.setInterval(() => void run(), EVERY_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [items, key, check]);

  const current = report?.forKey === key ? report : null;
  const checking = items.length > 0 && !current;
  const moved = current
    ? items.filter((i) => current.results.get(i.address)?.status === "moved")
    : [];

  return (
    <Panel
      title={moved.length ? `${moved.length === 1 ? "1 alert" : `${moved.length} alerts`} · funds moved` : "Watch"}
      subtitle="Wallets still holding funds on a CRITICAL case. Re-checked when this desk opens and every five minutes while it is open, in this browser."
      framed={false}
      actions={
        items.length ? (
          <button
            type="button"
            onClick={() => void check(items, key).then(setReport)}
            className={buttonStyles.ghost}
          >
            Check now
          </button>
        ) : null
      }
    >
      {!items.length ? (
        <p className="pt-4 text-sm leading-6 text-faint">
          Nothing is on watch in this browser. Trace a wallet whose funds are
          still at rest and it is added here automatically.
        </p>
      ) : (
        <>
          <p className="pt-4 font-mono text-xs text-faint">
            {checking
              ? `Checking ${items.length} ${items.length === 1 ? "wallet" : "wallets"}…`
              : current?.failure
                ? `Not checked — ${current.failure}`
                : `${items.length} watched · last checked ${formatDateTime(current?.checkedAt)}`}
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {[...items]
              // Alerts first: the row that needs an officer should not need scrolling to.
              .sort((a, b) => {
                const rank = (i: WatchItem) =>
                  current?.results.get(i.address)?.status === "moved" ? 0 : 1;
                return rank(a) - rank(b);
              })
              .map((item) => (
                <WatchRow
                  key={item.address}
                  item={item}
                  result={current?.results.get(item.address)}
                  checking={checking}
                />
              ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function WatchRow({
  item,
  result,
  checking,
}: {
  item: WatchItem;
  result: WatchResult | undefined;
  checking: boolean;
}) {
  const movedOut =
    result?.status === "moved"
      ? result.movements.reduce((sum, m) => sum + m.valueUsdt, 0)
      : 0;

  /*
   * Grouped by destination, largest first. A wallet that has started moving
   * usually does it in many transfers — the first real alert this fired on sent
   * fifty in a day, one every thirty minutes — and fifty rows of the same
   * address is noise where "where did it go" is the only question.
   */
  const destinations =
    result?.status === "moved"
      ? [
          ...result.movements
            .reduce((map, m) => {
              const row = map.get(m.to) ?? {
                to: m.to,
                toPhrase: m.toPhrase,
                total: 0,
                count: 0,
                first: m.timestamp,
                last: m.timestamp,
              };
              row.total += m.valueUsdt;
              row.count += 1;
              if (m.timestamp < row.first) row.first = m.timestamp;
              if (m.timestamp > row.last) row.last = m.timestamp;
              return map.set(m.to, row);
            }, new Map<string, { to: string; toPhrase: string | null; total: number; count: number; first: string; last: string }>())
            .values(),
        ].sort((a, b) => b.total - a.total)
      : [];
  const firstMovement =
    result?.status === "moved" && result.movements.length
      ? result.movements.reduce((min, m) => (m.timestamp < min ? m.timestamp : min), result.movements[0].timestamp)
      : null;

  return (
    <li
      className={`py-5 ${result?.status === "moved" ? "border-l-2 border-critical pl-4" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`font-label text-xs font-semibold uppercase tracking-[0.2em] ${
              result?.status === "moved"
                ? "text-critical"
                : result?.status === "still"
                  ? "text-muted"
                  : "text-faint"
            }`}
          >
            {checking || !result
              ? "Checking"
              : result.status === "moved"
                ? "Funds moved"
                : result.status === "still"
                  ? "Still at rest"
                  : "Not checked"}
          </p>
          <p className="mt-2 break-all font-mono text-sm text-ink">{item.address}</p>
          <p className="mt-1 text-xs leading-5 text-faint">
            {formatUsdt(item.heldUsdt, { symbol: false })} USDT at rest when case{" "}
            {item.caseId} was read, {formatDateTime(item.since)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/trace/${encodeURIComponent(item.caseAddress)}`}
            className="fx-option px-3 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass"
          >
            {result?.status === "moved" ? "Re-trace" : "Open case"}
          </Link>
          <button
            type="button"
            onClick={() => removeWatch(item.address)}
            className="fx-option-quiet px-3 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass"
          >
            Stop watching
          </button>
        </div>
      </div>

      {result?.status === "moved" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-ink">
            {result.complete ? "" : "At least "}
            {formatUsdt(movedOut, { symbol: false })} USDT has left this wallet since
            the case was read, starting {formatDateTime(firstMovement)}.
            {movedOut > item.heldUsdt
              ? " That is more than it held when read, so it has also received funds since."
              : null}
          </p>
          <ul className="space-y-2">
            {destinations.slice(0, 3).map((d) => (
              <li key={d.to} className="text-xs leading-5 text-faint">
                <span className="font-mono text-muted">{formatUsdt(d.total, { symbol: false })} USDT</span>{" "}
                →{" "}
                <Link
                  href={`/wallet/${encodeURIComponent(d.to)}`}
                  className="font-mono text-muted transition hover:text-brass"
                >
                  {shortAddress(d.to)}
                </Link>
                {d.toPhrase ? <span className="text-suspicious"> · {d.toPhrase}</span> : null}
                {" · "}
                {d.count === 1
                  ? formatDateTime(d.first)
                  : `${d.count} transfers, ${formatDateTime(d.first)} to ${formatDateTime(d.last)}`}
              </li>
            ))}
          </ul>
          {destinations.length > 3 ? (
            <p className="text-xs text-faint">
              and {destinations.length - 3} more {destinations.length - 3 === 1 ? "destination" : "destinations"}.
            </p>
          ) : null}
          {result.complete ? null : (
            <p className="text-xs leading-5 text-faint">
              More movement exists than one read returns; the figures above are a floor.
            </p>
          )}
        </div>
      ) : result?.status === "unchecked" ? (
        <p className="mt-3 text-xs leading-5 text-faint">{result.reason}</p>
      ) : null}
    </li>
  );
}
