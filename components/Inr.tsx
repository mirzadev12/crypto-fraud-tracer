"use client";

import { useEffect, useState } from "react";
import { formatInr, formatRate } from "@/lib/inr-format";

/**
 * "≈ ₹3.72 lakh" beside a USDT amount, at the USDT/INR rate an Indian exchange
 * is quoting now (GET /api/rate, lib/inr.ts). The source and the time of the
 * read are on the figure itself, in the title. One read per page, shared by
 * every figure on it. Shows nothing while the rate loads and nothing at all
 * when no exchange answered: a rupee figure without a rate behind it is the
 * one thing this must never print.
 */

type Rate = { rate: number; source: string; readAt: string };

let shared: Promise<Rate | null> | null = null;

function loadRate(): Promise<Rate | null> {
  shared ??= fetch("/api/rate", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: unknown) => {
      const r = body as Partial<Rate> | null;
      return r && typeof r.rate === "number" && typeof r.source === "string" && typeof r.readAt === "string"
        ? { rate: r.rate, source: r.source, readAt: r.readAt }
        : null;
    })
    .catch(() => null);
  return shared;
}

export function useInrRate(): Rate | null {
  const [rate, setRate] = useState<Rate | null>(null);
  useEffect(() => {
    let alive = true;
    void loadRate().then((r) => {
      if (alive) setRate(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  return rate;
}

/** "14:05 IST": the read time, in the officer's own clock. */
function istTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} IST`;
}

export default function Inr({ usdt, className = "" }: { usdt: number; className?: string }) {
  const rate = useInrRate();
  if (!rate || !(usdt > 0)) return null;
  return (
    <span
      className={`font-mono tabular-nums text-muted ${className}`}
      title={`At ${rate.source} USDT/INR ${formatRate(rate.rate)}, read ${istTime(rate.readAt)} (${rate.readAt})`}
    >
      ≈ {formatInr(usdt * rate.rate)}
      <span className="ml-1 text-faint">at {rate.source} {formatRate(rate.rate)}</span>
    </span>
  );
}
