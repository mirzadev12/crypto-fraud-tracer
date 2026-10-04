/**
 * The loading graphic for a case: a trace being read, hop by hop, in the same
 * vocabulary as the landing page's drawing — a subject wallet, three columns of
 * hops, dashed legs carrying a brass packet outward. When the server streams
 * its progress (`hop`), the columns light up to the hop actually reached, so
 * the drawing is the real state of the read rather than a spinner; without it
 * (a page still being fetched) the first hop is shown in progress.
 *
 * It carries no address and no figure. Pure markup: the motion is the existing
 * `fx-flow` and `fx-packet` utilities, both handled under
 * `prefers-reduced-motion` in globals.css, which leaves the drawing still.
 */

const COLUMNS = [44, 228, 412, 596] as const;
const ROWS = [26, 60, 94] as const;

/** One leg from a wallet in one column to a wallet in the next. */
function leg(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export default function ChainReading({
  hop = 1,
  label = "Reading the chain",
}: {
  /** The deepest hop reached so far, 0–3; the column being read is lit brass. */
  hop?: number;
  label?: string;
}) {
  const reached = Math.max(0, Math.min(3, hop));
  // Legs out of the subject to the first hop, then from each hop's middle wallet on.
  const legs = COLUMNS.slice(1).flatMap((x, c) =>
    ROWS.map((y, r) => ({
      d: leg(COLUMNS[c], c === 0 ? 60 : ROWS[1], x, y),
      hop: c + 1,
      key: `${c}-${r}`,
      r,
    })),
  );

  return (
    <figure className="m-0" aria-label={label} role="img">
      <svg viewBox="0 0 640 120" className="h-auto w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {legs.map((l) => {
          const live = l.hop <= Math.max(1, reached);
          const current = l.hop === Math.max(1, reached);
          return (
            <g key={l.key}>
              <path
                d={l.d}
                fill="none"
                stroke={live ? "var(--color-brass)" : "var(--color-line)"}
                strokeOpacity={live ? (current ? 0.9 : 0.45) : 0.8}
                strokeWidth={1.25}
                strokeDasharray="5 7"
                className={current ? "fx-flow" : undefined}
              />
              {current ? (
                <circle className="fx-packet" r={2.5} fill="var(--color-brass)">
                  <animateMotion dur="1.8s" begin={`${l.r * 0.45}s`} repeatCount="indefinite" path={l.d} />
                </circle>
              ) : null}
            </g>
          );
        })}
        {COLUMNS.slice(1).map((x, c) =>
          ROWS.map((y) => {
            const lit = c + 1 <= reached;
            return (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={4}
                fill={lit ? "var(--color-brass)" : "var(--color-surface-2)"}
                fillOpacity={lit ? 0.85 : 1}
                stroke={lit ? "var(--color-brass)" : "var(--color-line)"}
                strokeWidth={1}
              />
            );
          }),
        )}
        {/* The subject wallet, with a ring that breathes while the read runs. */}
        <circle cx={COLUMNS[0]} cy={60} r={13} fill="none" stroke="var(--color-brass)" strokeOpacity={0.5} className="fx-mark" />
        <circle cx={COLUMNS[0]} cy={60} r={6.5} fill="var(--color-suspicious)" />
        {COLUMNS.slice(1).map((x, c) => (
          <text
            key={`hop-${x}`}
            x={x}
            y={116}
            textAnchor="middle"
            className="font-label"
            fontSize={9}
            letterSpacing="0.16em"
            fill={c + 1 <= Math.max(1, reached) ? "var(--color-brass)" : "var(--color-faint)"}
          >
            HOP {c + 1}
          </text>
        ))}
      </svg>
    </figure>
  );
}
