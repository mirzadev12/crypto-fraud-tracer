"use client";

/**
 * Freeze requests and what came of them, counted by exchange (lib/outcomes.ts).
 *
 * The desk's own record: which exchanges freeze, which refuse or stay silent,
 * and how long an answer takes. Every figure is counted from the requests
 * recorded in this browser and says how many, because three requests are not a
 * measure of an exchange. Export and import are how a unit combines desks —
 * there is no server copy, and the panel says so.
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { STATUS_LABEL, byExchange, outcomesCsv, type Outcome } from "@/lib/outcomes";
import { importOutcomes, useOutcomes } from "@/lib/outcome-store";
import { count, formatUsdt, shortAddress } from "@/lib/format";
import { Designation, Panel, buttonStyles } from "./ui";

const TONE: Record<Outcome["status"], string> = {
  sent: "text-muted",
  acknowledged: "text-muted",
  frozen: "text-confirmed",
  "partly-frozen": "text-confirmed",
  refused: "text-critical",
  "no-response": "text-suspicious",
};

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OutcomesDesk() {
  const outcomes = useOutcomes();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importOutcomes(JSON.parse(await f.text()));
      setMessage(n ? `${count(n, "record")} merged from ${f.name}.` : `${f.name} held no FineX outcome records.`);
    } catch {
      setMessage(`${f.name} is not a FineX outcomes file.`);
    }
    if (file.current) file.current.value = "";
  };

  const importControl = (
    <>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import outcome records"
        onChange={(e) => onImport(e.target.files?.[0])}
      />
      <button type="button" onClick={() => file.current?.click()} className={buttonStyles.ghost}>
        Import records
      </button>
    </>
  );

  if (!outcomes.length) {
    return (
      <Panel title="Freeze requests and outcomes" framed={false}>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <p className="max-w-2xl text-sm leading-7 text-faint">
            No freeze request has been recorded in this browser. After sending one, record the
            exchange&rsquo;s answer on the request itself.
          </p>
          {importControl}
        </div>
        {message ? <p className="mt-2 text-xs text-faint" aria-live="polite">{message}</p> : null}
      </Panel>
    );
  }

  const rows = byExchange(outcomes);
  // The file's date is read when it is saved, never during render.
  const stamp = () => new Date().toISOString().slice(0, 10);
  return (
    <Panel
      title="Freeze requests and outcomes"
      subtitle={`Counted from the ${count(outcomes.length, "request")} recorded in this browser — not a measure of any exchange beyond them.`}
      framed={false}
    >
      <div className="fx-scroll mt-4 min-w-0 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line font-label text-xs uppercase tracking-[0.16em] text-faint">
              <th className="py-2 pr-4 font-normal">Exchange</th>
              <th className="py-2 pr-4 text-right font-normal">Requests</th>
              <th className="py-2 pr-4 text-right font-normal">Frozen</th>
              <th className="py-2 pr-4 text-right font-normal">Refused</th>
              <th className="py-2 pr-4 text-right font-normal">Unanswered</th>
              <th className="py-2 pr-4 text-right font-normal">Days to answer</th>
              <th className="py-2 text-right font-normal">USDT frozen / traced</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.exchange} className="border-b border-line-soft">
                <td className="py-2 pr-4 text-ink">{r.exchange}</td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-ink">{r.requests}</td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-confirmed">{r.frozen}</td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-critical">{r.refused}</td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted">{r.unanswered}</td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted">
                  {r.medianDays === null ? "—" : `${r.medianDays} (median of ${r.daysMeasured})`}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-muted">
                  {formatUsdt(r.frozenUsdt, { symbol: false })} / {formatUsdt(r.tracedUsdt, { symbol: false })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10">
        <Designation>Requests, latest first</Designation>
        <ul className="mt-2 divide-y divide-line-soft">
          {outcomes.map((o) => (
            <li key={`${o.chain}:${o.address}:${o.account}`} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {o.exchange} · <span className="font-mono">{shortAddress(o.account)}</span>
                  {o.ack ? <span className="text-faint"> · NCRP {o.ack}</span> : null}
                </p>
                <p className="mt-1 text-xs leading-5 text-faint">
                  {o.caseId}
                  {o.sentOn ? ` · sent ${o.sentOn}` : ""}
                  {o.answeredOn ? ` · answered ${o.answeredOn}` : ""}
                  {o.frozenUsdt !== undefined ? ` · ${formatUsdt(o.frozenUsdt)} frozen` : ""}
                  {o.reference ? ` · ref ${o.reference}` : ""}
                </p>
              </div>
              {/* Wraps rather than refusing to shrink: "Sent, awaiting answer"
                  beside its button is wider than a phone's row. */}
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className={`font-label text-xs uppercase tracking-[0.16em] ${TONE[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
                <Link href={o.href} className={buttonStyles.ghost}>
                  Open request
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => download(`finex-outcomes-${stamp()}.csv`, "text/csv", outcomesCsv(outcomes))}
          className={buttonStyles.secondary}
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => download(`finex-outcomes-${stamp()}.json`, "application/json", JSON.stringify(outcomes, null, 2))}
          className={buttonStyles.ghost}
        >
          Export for another desk
        </button>
        {importControl}
        <p className="text-xs text-faint" aria-live="polite">
          {message ?? "Kept in this browser only. Export to share; importing merges, keeping the later update of each request."}
        </p>
      </div>
    </Panel>
  );
}
