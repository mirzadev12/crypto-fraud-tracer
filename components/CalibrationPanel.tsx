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

interface BandRow {
  band: string;
  measured: number;
  held: number;
  continued: number;
  rate: number | null;
}

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
  perBand: BandRow[];
}

export default function CalibrationPanel({ data }: { data: Calibration }) {
  const gradientEvidenced =
    data.perBand.filter((b) => b.measured > 0 && b.rate !== null).some((b) => (b.rate ?? 1) < 1);

  return (
    <Panel
      title="Is the confidence figure measured or asserted?"
      subtitle={`A sample re-read from the chain on ${formatDate(data.generatedAt)} and re-tested with the clustering's own rule.`}
      className="mt-16"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------------- headline */}
        <div className="min-w-0">
          <Designation>Held on re-reading</Designation>
          <p className="mt-4 font-mono text-5xl font-light tabular-nums text-ink">
            {data.held}
            <span className="text-faint">/{data.readable}</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Of {data.readable} derived addresses re-read from the chain, {data.held} still
            forward at least {Math.round(data.predicate.minRatio * 100)}% of what they
            receive to the same exchange wallet, at least {data.predicate.minSweeps} times.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            <span className="text-ink">{data.continued}</span> of them have swept more times
            than the derivation recorded — the pattern continued on transfers the
            clustering never read, which is the part that could have failed and did not.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 text-xs">
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
                ≥{data.predicate.minSweeps} sweeps · ≥{Math.round(data.predicate.minRatio * 100)}%
              </dd>
            </div>
          </dl>
        </div>

        {/* ---------------------------------------------------------- bands */}
        <div className="min-w-0">
          <Designation>By confidence band</Designation>
          <ul className="mt-5 space-y-4">
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

          {/* The finding that matters more than the headline. */}
          <div className="mt-8 border-l-2 border-suspicious pl-5">
            <Designation className="!text-suspicious">
              What this does not show
            </Designation>
            <p className="mt-3 text-sm leading-6 text-muted">
              {gradientEvidenced ? (
                <>
                  The bands differ, so the confidence figure carries some ordering
                  information — but the sample is small and the difference should not be
                  quoted as a precision.
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
    </Panel>
  );
}
