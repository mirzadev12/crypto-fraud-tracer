"use client";

/**
 * Save case: put the run on screen into the shared case file, where every
 * officer using this server sees it on the Case queue.
 *
 * Offered only for a run the server itself traced — live or recorded — because
 * the server builds the saved case from its own audit record of that trace, and
 * an illustrative case was never traced at all. Once saved it reads "In case
 * file" and leads there. Loading state follows the `TraceLoader` pattern: a
 * reading is tagged with the run it was taken for.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DataSource } from "@/lib/api";
import { isIllustrative } from "@/lib/api";
import { isSaved, listCases, saveCase } from "@/lib/cases-client";
import { findingsFingerprint } from "@/lib/fingerprint";
import type { TraceResult } from "@/lib/types";

interface Reading {
  forKey: string;
  saved: boolean;
  error?: string;
}

export default function SaveCase({
  trace,
  source,
  className,
}: {
  trace: TraceResult;
  source: DataSource;
  className: string;
}) {
  const fingerprint = useMemo(() => findingsFingerprint(trace), [trace]);
  const key = `${trace.inputAddress}@${fingerprint}`;
  const offered = source !== "illustrative" && !isIllustrative(trace.inputAddress);
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!offered) return;
    let live = true;
    void listCases().then((r) => {
      if (live) setReading({ forKey: key, saved: r.ok && isSaved(r.cases, trace, fingerprint) });
    });
    return () => {
      live = false;
    };
  }, [offered, key, trace, fingerprint]);

  if (!offered) return null;
  const current = reading?.forKey === key ? reading : null;

  if (current?.saved) {
    return (
      <Link href="/dashboard#case-file" className={className}>
        In case file
      </Link>
    );
  }

  const save = async () => {
    setBusy(true);
    const r = await saveCase(trace);
    setReading({ forKey: key, saved: r.ok, ...(r.ok ? {} : { error: r.error }) });
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!current || busy}
      className={className}
      title={current?.error ?? "Keep this run in the case file every officer on this server sees"}
    >
      {busy ? "Saving…" : current?.error ? "Not saved" : "Save case"}
    </button>
  );
}
