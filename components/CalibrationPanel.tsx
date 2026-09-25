import type { ReactNode } from "react";
import { Designation, Panel } from "@/components/ui";
import { formatDate } from "@/lib/format";

/**
 * Whether the confidence figure on a derived row means anything.
 *
 * Every deposit address carries a confidence, and it came from one line in
 * `scripts/cluster.mjs` — `0.5 + sweeps * 0.03`, capped at 0.95. That formula
 * was written into a plan and never checked, which makes it an assertion. A
 * confidence figure exists to say that a row scoring high is right more often
 * than a row scoring low, and nobody had established that.
 *
 * `scripts/calibrate-clustering.mjs` measures it: a stratified sample of rows,
 * re-read from the chain today and re-tested with the clustering's own
 * predicate. This panel prints what came back, including the part that did not
 * come out well.
 *
 * **The panel states the negative result on purpose.** Every confidence band
 * scored the same, so the measurement gives no evidence that 0.95 is a better
 * row than 0.56 — and burying that while printing "100%" in brass would be
 * exactly the overstatement the rest of this register exists to avoid. The
 * honest reading is that the *predicate* is strong and the *gradient* is
 * unevidenced, and that is what it says.
 */

interface Tally {
  measured: number;
  held: number;
  continued: number;
  rate: number | null;
}

type BandRow = Tally & { band: string };

export interface Calibration {
  generatedAt: string;
  population: number;
  sampled: number;
  readable: number;
  unreadable: number;
  held: number;
  continued: number;
  overallRate: number | null;
  predicate: { minSweeps: number; minRatio: number };
  /** When the rows were derived, where recorded; the gap to generatedAt is how long the pattern had to fail. */
  derivedAt?: string | null;
  perBand: BandRow[];
  /** Ethereum only: rows found by their sweeps, by the exchange's gas wallet, or both. */
  perRoute?: Array<Tally & { route: string }>;
}

const ROUTE_NAME: Record<string, string> = {
  sweep: "Sweeps",
  funder: "Gas-funded",
  both: "Both",
};

/**
 * What the per-band rates say about the confidence figure, from the numbers
 * alone. Only rates that rise with the band are evidence the figure orders
 * rows; rates that differ in any other order are evidence it does not.
 */
function gradientOf(bands: BandRow[]): "same" | "rising" | "unordered" {
  const rates = bands
    .filter((b) => b.measured > 0 && b.rate !== null)
    .sort((a, b) => a.band.localeCompare(b.band))
    .map((b) => b.rate as number);
  if (rates.every((r) => r === rates[0])) return "same";
  return rates.every((r, i) => i === 0 || r >= rates[i - 1]) ? "rising" : "unordered";
}

export default function CalibrationPanel({
  data,
  title = "Is the confidence figure measured or asserted?",
  rule,
  className = "mt-16",
  children,
}: {
  data: Calibration;
  title?: string;
  /** The rule re-applied, when it is not the TRON one: a clause for the headline and a short label. */
  rule?: { clause: string; label: string };
  className?: string;
  /** A further measurement, set under the two columns. */
  children?: ReactNode;
}) {
  const gradient = gradientOf(data.perBand);
  const everyRow = data.sampled === data.population;
  // How long the pattern had to fail. Both moments come from the data, never
  // the clock, so the sentence is the same on every render.
  const gapHours = data.derivedAt
    ? (new Date(data.generatedAt).getTime() - new Date(data.derivedAt).getTime()) / 3_600_000
    : null;
  const gap =
    gapHours === null || !Number.isFinite(gapHours)
      ? null
      : gapHours < 48
        ? `${Math.max(1, Math.round(gapHours))} hours`
        : `${Math.round(gapHours / 24)} days`;
  const soon = gapHours !== null && gapHours < 24 * 7;

  return (
    <Panel
      title={title}
      subtitle={`${everyRow ? "Every derived address" : "A sample"} re-read from the chain on ${formatDate(data.generatedAt)} and re-tested with the clustering's own rule.`}
      className={className}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------------- headline */}
        <div className="min-w-0">
          <Designation>Held on re-reading</Designation>
          <p className="mt-4 font-mono text-5xl font-light tabular-nums text-ink">
            {data.held}
            <span className="text-faint">/{data.readable}</span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Of {data.readable} derived addresses re-read from the chain, {data.held} still{" "}
            {rule?.clause ??
              `forward at least ${Math.round(data.predicate.minRatio * 100)}% of what they receive to the same exchange wallet, at least ${data.predicate.minSweeps} times`}
            .
          </p>
          {soon ? (
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Re-read {gap} after the derivation, so most rows were re-tested on the very
              transfers that found them, which shows only that nothing reversed. The test is
              the rows that swept again since.
            </p>
          ) : null}
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            <span className="text-ink">{data.continued}</span> of them have swept more times
            than the derivation recorded — the pattern continued on transfers the
            clustering never read, which is the part that could have failed and did not.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 text-xs">
            <div>
              <dt className="font-label uppercase tracking-[0.2em] text-faint">Population</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">{data.population}</dd>
            </div>
            <div>
              <dt className="font-label uppercase tracking-[0.2em] text-faint">Sampled</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">{data.sampled}</dd>
            </div>
            <div>
              <dt className="font-label uppercase tracking-[0.2em] text-faint">Unreadable</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">{data.unreadable}</dd>
            </div>
            <div>
              <dt className="font-label uppercase tracking-[0.2em] text-faint">Rule</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">
                {rule?.label ??
                  `≥${data.predicate.minSweeps} sweeps · ≥${Math.round(data.predicate.minRatio * 100)}%`}
              </dd>
            </div>
          </dl>
        </div>

        {/* ---------------------------------------------------------- bands */}
        <div className="min-w-0">
          <Designation>By confidence band</Designation>
          <ul className="mt-4 space-y-4">
            {data.perBand.map((b) => (
              <li key={b.band} className="flex items-center gap-4">
                <span className="w-24 shrink-0 font-mono text-xs text-faint">{b.band}</span>
                <span className="h-[6px] min-w-0 flex-1 bg-surface-2">
                  <span
                    className="block h-full bg-brass-dim"
                    style={{ width: `${(b.rate ?? 0) * 100}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                  {b.held}/{b.measured}
                </span>
              </li>
            ))}
          </ul>

          {data.perRoute?.length ? (
            <>
              <Designation className="mt-10">By route</Designation>
              <ul className="mt-4 space-y-4">
                {data.perRoute
                  .filter((r) => r.measured > 0)
                  .map((r) => (
                    <li key={r.route} className="flex items-center gap-4">
                      <span className="w-24 shrink-0 font-mono text-xs text-faint">
                        {ROUTE_NAME[r.route] ?? r.route}
                      </span>
                      <span className="h-[6px] min-w-0 flex-1 bg-surface-2">
                        <span
                          className="block h-full bg-brass-dim"
                          style={{ width: `${(r.rate ?? 0) * 100}%` }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                        {r.held}/{r.measured}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}

          {/* The finding that matters more than the headline. */}
          <div className="mt-6 border-l-2 border-suspicious pl-6">
            <Designation className="!text-suspicious">
              What this does not show
            </Designation>
            <p className="mt-4 text-sm leading-6 text-muted">
              {gradient === "rising" ? (
                <>
                  The rate rises with the band, so the confidence figure carries some
                  ordering information — but the numbers in each band are small and the
                  difference should not be quoted as a precision. It is still not a
                  probability that the attribution is correct.
                </>
              ) : gradient === "unordered" ? (
                <>
                  The bands differ, but not in the order the confidence figure predicts. So
                  this measurement gives{" "}
                  <span className="text-ink">no evidence that a higher figure is a better
                  row</span>. The confidence figure should be read as &ldquo;how much sweep
                  evidence was seen&rdquo;, which is what it counts, and not as a
                  probability that the attribution is correct.
                </>
              ) : (
                <>
                  Every band scored the same. So this measurement gives{" "}
                  <span className="text-ink">no evidence that a 0.95 row is better than a
                  0.56 row</span> — it shows the rule itself is strong, not that the number
                  ordering the rows is meaningful. The confidence figure should be read as
                  &ldquo;how much sweep evidence was seen&rdquo;, which is what it counts,
                  and not as a probability that the attribution is correct.
                </>
              )}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted">
              And it is not proof of ownership. Both the derivation and this check read the
              same public endpoint, so it tests whether the pattern <em>persists</em>. Only
              the exchange can confirm whose account an address is.
            </p>
          </div>
        </div>
      </div>
      {children}
    </Panel>
  );
}
