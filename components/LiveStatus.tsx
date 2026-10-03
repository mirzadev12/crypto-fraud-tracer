"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import type { ChainHead, Status } from "@/lib/status";
import { Diamond } from "./ui";

/**
 * One quiet line that proves the screen is reading the chain now: each chain's
 * newest block and how long ago it was produced, the date of the sanctions list
 * carried, and how many traces this server answered today.
 *
 * Polled every 30 seconds while the tab is visible (the server keeps each read
 * for 30 seconds too). A new block number settles in with the house `fx-settle`
 * movement and the brass lozenge turns a quarter, once per read; under reduced
 * motion both simply change. A chain that did not answer says so; it never
 * keeps showing the last number it had.
 */

const POLL_MS = 30_000;

function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ago(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
}

export default function LiveStatus({ className = "" }: { className?: string }) {
  const [read, setRead] = useState<{ status: Status; receivedAt: number; count: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<Status>) : Promise.reject(new Error(String(res.status)))))
        .then((status) => {
          if (!alive) return;
          setRead((prev) => ({ status, receivedAt: Date.now(), count: (prev?.count ?? 0) + 1 }));
          setFailed(false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    void load();
    const poll = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  if (!read) {
    return (
      <p className={`font-mono text-xs text-faint ${className}`}>
        {failed ? "Live chain status could not be read." : "Reading the chains…"}
      </p>
    );
  }

  const { status, receivedAt, count } = read;
  const elapsed = now ? Math.max(0, Math.round((now - receivedAt) / 1000)) : 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-faint ${className}`}
      title={`Read ${status.generatedAt}`}
    >
      <span className="flex items-center gap-2 font-label uppercase tracking-[0.2em] text-muted">
        <Diamond
          className={`bg-brass transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            count % 2 ? "rotate-[135deg]" : ""
          }`}
        />
        Live
      </span>
      {status.heads.map((h) => (
        <Head key={h.chain} head={h} elapsed={elapsed} />
      ))}
      <span>OFAC list of {formatDate(status.ofac.published)}</span>
      <span>
        {status.traces.today
          ? `${status.traces.today} ${status.traces.today === 1 ? "trace" : "traces"} answered today`
          : "No traces yet today"}
      </span>
      {failed ? <span className="text-suspicious">Last refresh failed; showing the previous read</span> : null}
    </div>
  );
}

function Head({ head, elapsed }: { head: ChainHead; elapsed: number }) {
  if (head.block === null || head.ageSeconds === null) {
    return (
      <span>
        <span className="text-muted">{head.name}</span> not answering
      </span>
    );
  }
  return (
    <span title={head.at ?? undefined}>
      <span className="text-muted">{head.name}</span>{" "}
      <span key={head.block} className="fx-settle inline-block tabular-nums text-ink">
        {grouped(head.block)}
      </span>{" "}
      <span className="tabular-nums">· {ago(head.ageSeconds + elapsed)}</span>
    </span>
  );
}
