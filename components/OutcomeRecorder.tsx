"use client";

/**
 * "Record what happened" — set beside a freeze request, never printed. The
 * officer records whether the request went out and what the exchange did; the
 * desk on the case queue counts it (lib/outcomes.ts). Kept in this browser,
 * and it says so.
 */

import { useState } from "react";
import {
  OUTCOME_STATUSES,
  STATUS_LABEL,
  outcomeKey,
  type Outcome,
  type OutcomeFields,
  type OutcomeStatus,
  type OutcomeTarget,
} from "@/lib/outcomes";
import { removeOutcome, saveOutcomes, useOutcomes } from "@/lib/outcome-store";
import { formatDateTime } from "@/lib/format";
import { Designation, buttonStyles } from "./ui";

const FIELD =
  "w-full min-w-0 border-0 border-b border-line bg-transparent px-0 py-2 font-mono text-sm text-ink placeholder:text-dim focus:border-brass";

export default function OutcomeRecorder({ targets }: { targets: OutcomeTarget[] }) {
  const outcomes = useOutcomes();
  if (!targets.length) return null;
  const keys = new Set(targets.map(outcomeKey));
  const held = outcomes.filter((o) => keys.has(outcomeKey(o)));
  // The form starts from what is already recorded, and starts again when that
  // changes (a save here, or in another tab) — a remount, not an effect.
  const latest = held[0] ?? null;
  return <Form key={latest?.updatedAt ?? "new"} targets={targets} held={held} latest={latest} />;
}

function Form({ targets, held, latest }: { targets: OutcomeTarget[]; held: Outcome[]; latest: Outcome | null }) {
  const single = targets.length === 1;
  const [status, setStatus] = useState<OutcomeStatus>(latest?.status ?? "sent");
  const [sentOn, setSentOn] = useState(latest?.sentOn ?? "");
  const [answeredOn, setAnsweredOn] = useState(latest?.answeredOn ?? "");
  const [frozen, setFrozen] = useState(latest?.frozenUsdt !== undefined ? String(latest.frozenUsdt) : "");
  const [reference, setReference] = useState(latest?.reference ?? "");
  const [note, setNote] = useState(latest?.note ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const frozenValue = frozen.trim() === "" ? undefined : Number(frozen);
  const problem =
    frozenValue !== undefined && (!Number.isFinite(frozenValue) || frozenValue < 0)
      ? "The amount frozen must be a number of USDT, 0 or more."
      : sentOn && answeredOn && answeredOn < sentOn
        ? "The answer cannot come before the request was sent."
        : null;

  const save = () => {
    if (problem) return;
    const fields: OutcomeFields = {
      status,
      ...(sentOn ? { sentOn } : {}),
      ...(answeredOn ? { answeredOn } : {}),
      ...(single && frozenValue !== undefined ? { frozenUsdt: frozenValue } : {}),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const updatedAt = new Date().toISOString();
    // An NCRP number already recorded for a complaint (say, from the combined
    // letter) is kept when this request was opened without one.
    const before = new Map(held.map((o) => [outcomeKey(o), o]));
    const stored = saveOutcomes(
      targets.map((t) => {
        const prev = before.get(outcomeKey(t));
        const keep = !t.ack && prev?.ack ? { ack: prev.ack, href: prev.href } : {};
        return { ...t, ...keep, ...fields, updatedAt };
      }),
    );
    setMessage(stored ? "Saved in this browser." : "Not saved: this browser refused to store it (a private window, or site data blocked).");
  };

  return (
    <section className="border-l-2 border-line pl-4 print:hidden" aria-label="Record what happened">
      <Designation>Record what happened</Designation>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
        Once the request is sent, record the exchange&rsquo;s answer here
        {single ? "" : ` — it is recorded for each of the ${targets.length} complaints in this letter`}. The case
        queue counts these by exchange. They are kept in this browser only; export them from
        the case queue to share.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <label className="min-w-0">
          <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OutcomeStatus)}
            className={`${FIELD} bg-surface`}
          >
            {OUTCOME_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">Sent on</span>
          <input type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} className={FIELD} />
        </label>
        <label className="min-w-0">
          <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">Answered on</span>
          <input type="date" value={answeredOn} onChange={(e) => setAnsweredOn(e.target.value)} className={FIELD} />
        </label>
        {single ? (
          <label className="min-w-0">
            <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">USDT frozen</span>
            <input
              value={frozen}
              onChange={(e) => setFrozen(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={`${FIELD} tabular-nums`}
            />
          </label>
        ) : null}
        <label className="min-w-0">
          <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">Exchange&rsquo;s reference</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} className={FIELD} />
        </label>
        <label className="min-w-0 sm:col-span-2 lg:col-span-1">
          <span className="font-label text-xs uppercase tracking-[0.16em] text-faint">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={FIELD} />
        </label>
      </div>

      {problem ? <p className="mt-4 text-sm text-critical">{problem}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={!!problem} className={buttonStyles.secondary}>
          {latest ? "Update the record" : "Save the record"}
        </button>
        {held.length ? (
          <button
            type="button"
            onClick={() => {
              held.forEach(removeOutcome);
              setMessage("Record removed from this browser.");
            }}
            className={buttonStyles.ghost}
          >
            Remove
          </button>
        ) : null}
        <p className="text-xs text-faint" aria-live="polite">
          {/* A save remounts this form from the stored record, so the stored
              record's own line is the confirmation; a refused save does not
              remount, and its message stays. */}
          {message ?? (latest ? `Saved in this browser · last recorded ${formatDateTime(latest.updatedAt)}.` : "Nothing recorded yet.")}
        </p>
      </div>
    </section>
  );
}
