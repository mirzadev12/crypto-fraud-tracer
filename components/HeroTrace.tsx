/**
 * The hero visual: one traced path, lit out of a cluster of wallets.
 *
 * The register is the bubble map on-chain intelligence is read in — wallets as
 * packed circles sized by how much they hold, linked where money moved — with
 * the path carrying the victim's money burning through it to a single exit.
 * That is the product's claim as a picture: the chain is mostly noise, and the
 * work is knowing which four addresses out of fifty are the case.
 *
 * Deliberately carries **no addresses and no amounts**. Every figure on it is a
 * taint percentage, which is a concept rather than a claim, or a rule the
 * pipeline actually applies. An invented address on the front page is the one
 * thing this interface cannot afford to look like it prints.
 *
 * Deterministic: the packing runs once at module load from a golden-angle
 * spiral with rejection sampling, so the cluster is identical on every render
 * and between server and client. Pure markup — no state, no effects, no
 * dependency. The motion is the existing `fx-flow`, `fx-settle`, `fx-sonar` and
 * `fx-packet` utilities, all already handled under `prefers-reduced-motion`.
 */

const VIEW = { w: 760, h: 420 };

/**
 * The traced path, placed first so the cluster can be packed around it. It
 * reads left to right and rises to the exit, because the exit is the answer and
 * the answer should not be buried in the middle of the field.
 */
const LIT = [
  { x: 168, y: 246, r: 36, taint: "100%", label: "SUBJECT" },
  { x: 330, y: 168, r: 21, taint: "71%", label: null },
  { x: 470, y: 232, r: 18, taint: "64%", label: null },
  { x: 622, y: 152, r: 46, taint: "58%", label: "EXIT" },
] as const;

interface Bubble {
  x: number;
  y: number;
  r: number;
  /** Fades with distance from the subject — the far chain is barely there. */
  o: number;
}

/**
 * The surrounding wallets, packed rather than scattered. Candidates come off a
 * golden-angle spiral and are rejected where they would collide with the traced
 * path or with a bubble already placed, which is what makes it read as a
 * cluster instead of a star field.
 */
const FIELD: Bubble[] = (() => {
  const GOLDEN = 2.39996323;
  const out: Bubble[] = [];
  const cx = 330;
  const cy = 214;

  for (let i = 1; i <= 900 && out.length < 96; i++) {
    const angle = i * GOLDEN;
    const rad = 11.5 * Math.sqrt(i);
    const x = cx + Math.cos(angle) * rad * 1.62;
    const y = cy + Math.sin(angle) * rad * 1.02;
    const r = 4 + ((i * 13) % 8) * 2.3;

    if (x - r < 14 || x + r > VIEW.w - 14) continue;
    if (y - r < 14 || y + r > VIEW.h - 30) continue;
    // Clear of the finding: the traced path must never fight the noise.
    if (LIT.some((l) => Math.hypot(l.x - x, l.y - y) < l.r + r + 13)) continue;
    if (out.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 5)) continue;

    const near = Math.hypot(LIT[0].x - x, LIT[0].y - y);
    out.push({ x, y, r, o: Math.max(0.18, 0.68 - near / 780) });
  }
  return out;
})();

/** A sparse web: each wallet tied to the nearest one already placed. */
const WEB: Array<[Bubble, Bubble]> = (() => {
  const out: Array<[Bubble, Bubble]> = [];
  for (let i = 1; i < FIELD.length; i++) {
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(FIELD[i].x - FIELD[j].x, FIELD[i].y - FIELD[j].y);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    if (best >= 0 && bestDist < 96) out.push([FIELD[i], FIELD[best]]);
  }
  return out;
})();

/** A gentle arc rather than a straight line — money does not move in rulers. */
function arc(a: (typeof LIT)[number], b: (typeof LIT)[number]): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Bow perpendicular to the run, always upward, so the path reads as one sweep.
  const bow = 26;
  return `M ${a.x} ${a.y} Q ${mx + (dy / len) * bow} ${my - (dx / len) * bow} ${b.x} ${b.y}`;
}

export default function HeroTrace() {
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="h-auto w-full"
      role="img"
      aria-label="A cluster of wallets on the chain with one path lit through it: the victim-reported wallet, two hops carrying a falling share of the stolen funds, and an exit at an exchange deposit cluster."
    >
      {/* ------------------------------------------------- the chain as noise */}
      <g stroke="var(--color-line)" strokeWidth={1}>
        {WEB.map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            opacity={Math.min(a.o, b.o) * 0.55}
          />
        ))}
      </g>
      <g className="fx-settle">
        {FIELD.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="var(--color-surface-2)"
            stroke="var(--color-dim)"
            strokeWidth={1}
            opacity={n.o}
          />
        ))}
      </g>

      {/* ------------------------------------------------------- the movement */}
      {/* The first hop is drawn in suspicious amber: under ten minutes between
          receipt and forwarding is the signature of an automated script, and it
          is the one thing here a reader should catch before reading any word. */}
      <g className="fx-settle" style={{ animationDelay: "160ms" }}>
        {LIT.slice(0, -1).map((n, i) => (
          <path
            key={`leg-${i}`}
            d={arc(n, LIT[i + 1])}
            fill="none"
            stroke={i === 0 ? "var(--color-suspicious)" : "var(--color-brass)"}
            strokeWidth={2}
            strokeDasharray="6 8"
            strokeLinecap="round"
            className="fx-flow"
          />
        ))}

        {/* The money itself, moving. Each leg fires after the one before it, so
            the eye is carried from the subject out to the exit. */}
        {LIT.slice(0, -1).map((n, i) => {
          const d = arc(n, LIT[i + 1]);
          const begin = `${i * 0.55}s`;
          return (
            <circle
              key={`packet-${i}`}
              className="fx-packet"
              r={4}
              fill={i === 0 ? "var(--color-suspicious)" : "var(--color-brass)"}
            >
              <animateMotion
                dur="2.9s"
                begin={begin}
                repeatCount="indefinite"
                path={d}
                calcMode="spline"
                keyPoints="0;1"
                keyTimes="0;1"
                keySplines="0.45 0 0.55 1"
              />
              <animate
                attributeName="opacity"
                dur="2.9s"
                begin={begin}
                repeatCount="indefinite"
                values="0;1;1;0"
                keyTimes="0;0.12;0.85;1"
              />
            </circle>
          );
        })}
      </g>

      <text
        x={236}
        y={186}
        className="font-label"
        fontSize={10}
        letterSpacing="0.16em"
        fill="var(--color-suspicious)"
      >
        &lt; 10 MIN
      </text>

      {/* ---------------------------------------------------------- the path */}
      {LIT.map((n, i) => {
        const terminal = i === LIT.length - 1;
        const anchor = i === 0 || terminal;
        return (
          <g
            key={i}
            className="fx-settle"
            style={{ animationDelay: `${160 + i * 130}ms` }}
          >
            {anchor ? (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill="none"
                stroke="var(--color-brass)"
                className="fx-sonar"
                style={
                  {
                    "--fx-r0": `${n.r}px`,
                    "--fx-r1": `${n.r * 1.9}px`,
                    animationDelay: `${i * 900}ms`,
                  } as React.CSSProperties
                }
              />
            ) : null}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--color-brass)"
              fillOpacity={anchor ? 0.14 : 0.08}
              stroke={anchor ? "var(--color-brass)" : "var(--color-brass-dim)"}
              strokeWidth={anchor ? 2 : 1.5}
            />
            <text
              x={n.x}
              y={n.y + (terminal ? 6 : 4)}
              textAnchor="middle"
              className="font-mono"
              fontSize={terminal ? 17 : n.r > 30 ? 14 : 10}
              fill={anchor ? "var(--color-brass)" : "var(--color-muted)"}
            >
              {n.taint}
            </text>
            {n.label ? (
              <text
                x={n.x}
                y={n.y + n.r + 22}
                textAnchor="middle"
                className="font-label"
                fontSize={10}
                letterSpacing="0.2em"
                fill="var(--color-faint)"
              >
                {n.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* The finding, named. The largest mark on the picture is the answer. */}
      <g className="fx-settle" style={{ animationDelay: "760ms" }}>
        <rect
          x={528}
          y={244}
          width={192}
          height={30}
          fill="var(--color-surface-2)"
          stroke="var(--color-suspicious)"
          strokeWidth={1}
        />
        <rect
          x={541}
          y={255}
          width={8}
          height={8}
          transform="rotate(45 545 259)"
          fill="var(--color-suspicious)"
        />
        <text
          x={558}
          y={263}
          className="font-label"
          fontSize={10}
          letterSpacing="0.16em"
          fill="var(--color-suspicious)"
        >
          DEPOSIT CLUSTER
        </text>
      </g>
    </svg>
  );
}
