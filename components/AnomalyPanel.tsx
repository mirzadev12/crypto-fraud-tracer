"use client";

import { useMemo } from "react";
import baseline from "@/data/anomaly-baseline.json";
import { rankAnomalies, type Row } from "@/lib/anomaly";
import type { TraceResult } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { Panel } from "./ui";

/**
 * Advisory: the unlabelled wallets on this trail that behave least like the
 * wallets FineX has read before (lib/anomaly.ts, an isolation forest). A
 * ranking for an investigator's attention, shown below the rules because it
 * decides nothing: the disposition, the exit and every lead come from the
 * deterministic pipeline above, and the footnote says so in as many words.
 */

const SHOWN = 3;
/** About 0.5 is ordinary; this is where the panel starts calling a wallet unusual. */
const UNUSUAL = 0.6;

export default function AnomalyPanel({
  trace,
  selected,
  onSelect,
}: {
  trace: TraceResult;
  selected: string | null;
  onSelect: (address: string | null) => void;
}) {
  const ranking = useMemo(() => rankAnomalies(trace, baseline.rows as Row[]), [trace]);
  const top = ranking.scored.slice(0, SHOWN);
  const caseCount = baseline._cases;

  return (
    <Panel
      title="Unusual wallets · advisory"
      subtitle="Machine-ranked for a closer look. It decides nothing."
      className="mt-6"
    >
      {top.length === 0 ? (
        <p className="text-sm leading-6 text-faint">
          No unlabelled wallet past the reported one on this trail, so there is nothing to rank.
        </p>
      ) : (
        <ol className="divide-y divide-line-soft">
          {top.map((s, i) => {
            const unusual = s.score >= UNUSUAL;
            const active = selected === s.address;
            return (
              <li key={s.address}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : s.address)}
                  aria-pressed={active}
                  className={`fx-option-quiet grid w-full grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2 px-2 py-4 text-left sm:grid-cols-[auto_1fr_10rem] ${
                    active ? "fx-option-on" : ""
                  }`}
                >
                  <span className="font-mono text-xs text-faint">{i + 1}</span>
                  <span className="min-w-0 space-y-1">
                    {/* Plain text, not an AddressChip: the chip carries its own copy
                        button, and a button cannot sit inside this row's button. */}
                    <span className="block font-mono text-sm text-ink" title={s.address}>
                      {shortAddress(s.address)}
                    </span>
                    <span className="block text-xs leading-5 text-muted">
                      {s.drivers.length
                        ? s.drivers.join("; ")
                        : "No single feature sets it apart; the combination does."}
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-3">
                    <span className="flex items-baseline justify-between font-mono text-xs tabular-nums">
                      <span className={unusual ? "text-ink" : "text-faint"}>{s.score.toFixed(2)}</span>
                      <span className="font-label uppercase tracking-[0.16em] text-faint">
                        {unusual ? "unusual" : "ordinary"}
                      </span>
                    </span>
                    {/* The score as a length, so three rows compare at a glance. */}
                    <span className="mt-1 block h-1 bg-line" aria-hidden="true">
                      <span
                        className={`block h-full ${unusual ? "bg-brass" : "bg-dim"}`}
                        style={{ width: `${Math.round(s.score * 100)}%` }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-xs leading-5 text-faint">
        An isolation forest — unsupervised machine learning — over eight behaviours this trace
        measured (amount received, transfers out, fastest forward, pass-through, round figures,
        senders, wallet age, share of the money), trained on {ranking.baseline} wallets from the{" "}
        {caseCount} recorded cases and the {ranking.trainedOn - ranking.baseline} on this trail. The
        score says how easily a wallet&rsquo;s behaviour is told apart from the rest; it is not a
        probability of fraud. It never names an exit and never sets the case&rsquo;s status: those
        come from the rules and the attribution table above. With no confirmed outcomes to learn
        from, no accuracy figure exists, and none is claimed.
      </p>
    </Panel>
  );
}
