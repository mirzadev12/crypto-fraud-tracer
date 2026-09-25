"use client";

/**
 * The switch for alerts when the desk is closed, at the foot of the watch it
 * extends. One line: what happens, whether it is on in this browser, and when
 * the server last checked — including, plainly, when it had stopped running,
 * because a host that sleeps when idle checks nothing while asleep and the
 * officer should not have to guess that.
 *
 * Opening the desk sends the server this browser's list again (`syncAlerts`),
 * which is what restores a copy the server lost. Loading state follows the
 * `TraceLoader` pattern: a reading is tagged with the list it was taken for.
 */

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { syncAlerts, turnOffAlerts, turnOnAlerts, type AlertStatus } from "@/lib/alerts-client";
import type { WatchItem } from "@/lib/watch";

interface Reading {
  forKey: string;
  status: AlertStatus;
}

const OPTION =
  "fx-option shrink-0 px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass disabled:opacity-60";
const QUIET =
  "fx-option-quiet shrink-0 px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-faint transition hover:text-brass disabled:opacity-60";

function sentence(status: AlertStatus | null): string {
  if (!status) return "Checking this browser…";
  switch (status.kind) {
    case "unsupported":
      return "This browser cannot show alerts from a closed page.";
    case "blocked":
      return "Notifications are blocked for this site. Allow them in the browser's site settings to turn alerts on.";
    case "off":
      return "Off. Turn on, and the server checks these wallets every five minutes even with FineX closed, and this browser shows a notification when one moves.";
    case "error":
      return `Not available: ${status.reason}.`;
    case "on": {
      const run = status.server.lastRun;
      const head =
        "On. The server checks these wallets every five minutes even with FineX closed, and this browser shows a notification when one moves.";
      if (!run) return `${head} Its first check is due within a minute.`;
      if (!status.server.current) {
        return `${head} Its last check was ${formatDateTime(run.at)}; it had stopped running since, and resumes within a minute.`;
      }
      return `${head} Last check ${formatDateTime(run.at)}.`;
    }
  }
}

export default function ClosedAlerts({ items, listKey }: { items: WatchItem[]; listKey: string }) {
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState(false);

  // When the desk opens and whenever the list changes: where alerts stand, and
  // the list handed over again if they are on.
  useEffect(() => {
    let live = true;
    void syncAlerts(items).then((status) => {
      if (live) setReading({ forKey: listKey, status });
    });
    return () => {
      live = false;
    };
  }, [items, listKey]);

  const status = reading?.forKey === listKey ? reading.status : null;

  const toggle = async () => {
    setBusy(true);
    const next = status?.kind === "on" ? await turnOffAlerts() : await turnOnAlerts(items);
    setReading({ forKey: listKey, status: next });
    setBusy(false);
  };

  const canToggle = status && status.kind !== "unsupported" && status.kind !== "blocked";

  return (
    <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-2">
      <p className="w-full min-w-0 flex-1 text-xs leading-5 text-faint sm:w-auto" aria-live="polite">
        <span className="mr-2 font-label font-semibold uppercase tracking-[0.24em] text-muted">
          Alerts when closed
        </span>
        {sentence(status)}
      </p>
      {canToggle ? (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className={status.kind === "on" ? QUIET : OPTION}
        >
          {busy
            ? status.kind === "on"
              ? "Turning off…"
              : "Turning on…"
            : status.kind === "on"
              ? "Turn off"
              : "Turn on alerts"}
        </button>
      ) : null}
    </div>
  );
}
