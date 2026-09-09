/**
 * The hero visual: one traced path, lit out of the noise of the chain.
 *
 * The register is the cluster map the on-chain intelligence world reads at a
 * glance — a dense constellation of wallets, sized and dimmed by how little
 * they matter, with the path carrying the victim's money burning through it to
 * a single exit. That is the product's actual claim as a picture: the chain is
 * mostly noise, and the work is knowing which four addresses out of fifty are
 * the case.
 *
 * Deliberately carries **no addresses and no amounts**. Every figure on it is a
 * taint percentage, which is a concept rather than a claim, or a rule the
 * pipeline actually applies. An invented address on the front page is the one
 * thing this interface cannot afford to look like it prints.
 *
 * Deterministic: the field is a golden-angle spiral computed once at module
 * load, so the constellation is identical on every render and between server
 * and client. Pure markup — no state, no effects, no dependency. The motion is
 * the existing `fx-flow`, `fx-settle` and `fx-sonar` utilities, all already
 * switched off under `prefers-reduced-motion`.
 */

const VIEW = { w: 760, h: 420 };

/** The traced path. The subject sits at the heart of its own cluster. */
const LIT = [
  { x: 236, y: 208, r: 23, taint: "100%", label: "SUBJECT" },
  { x: 412, y: 142, r: 13, taint: "71%", label: null },
  { x: 528, y: 244, r: 11, taint: "64%", label: null },
  { x: 652, y: 176, r: 33, taint: "58%", label: "EXIT" },
] as const;

interface FieldNode {
  x: number;
  y: number;
  r: number;
  /** Fades with distance from the subject — the far chain is barely there. */
  o: number;
}

/**
 * The background wallets: a golden-angle spiral, stretched horizontally to fill
 * a wide panel. Nodes that would sit on the traced path are dropped, so the
 * finding never fights the noise it is supposed to stand out from.
 */
const FIELD: FieldNode[] = (() => {
  const GOLDEN = 2.39996323;
  const out: FieldNode[] = [];
  for (let i = 1; i <= 78; i++) {
    const angle = i * GOLDEN;
    const rad = 26 * Math.sqrt(i);
    const x = LIT[0].x + Math.cos(angle) * rad * 2.05;
    const y = LIT[0].y + Math.sin(angle) * rad * 1.02;
    if (x < 26 || x > VIEW.w - 26 || y < 26 || y > VIEW.h - 34) continue;
    if (LIT.some((l) => Math.hypot(l.x - x, l.y - y) < l.r + 30)) continue;
    const near = Math.hypot(LIT[0].x - x, LIT[0].y - y);
    out.push({
      x,
      y,
      r: 2 + ((i * 7) % 5) * 1.25,
      o: Math.max(0.16, 0.62 - near / 620),
    });
  }
  return out;
})();

/** A sparse web: each wallet tied to the nearest one already placed. */
const WEB: Array<[FieldNode, FieldNode]> = (() => {
  const out: Array<[FieldNode, FieldNode]> = [];
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
    if (best >= 0 && bestDist < 118) out.push([FIELD[i], FIELD[best]]);
  }
  return out;
})();

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
            opacity={Math.min(a.o, b.o) * 0.5}
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
        <line
          x1={LIT[0].x}
          y1={LIT[0].y}
          x2={LIT[1].x}
          y2={LIT[1].y}
          stroke="var(--color-suspicious)"
          strokeWidth={1.5}
          strokeDasharray="5 7"
          className="fx-flow"
        />
        <line
          x1={LIT[1].x}
          y1={LIT[1].y}
          x2={LIT[2].x}
          y2={LIT[2].y}
          stroke="var(--color-brass)"
          strokeWidth={1.5}
          strokeDasharray="5 7"
          className="fx-flow"
        />
        <line
          x1={LIT[2].x}
          y1={LIT[2].y}
          x2={LIT[3].x}
          y2={LIT[3].y}
          stroke="var(--color-brass)"
          strokeWidth={1.5}
          strokeDasharray="5 7"
          className="fx-flow"
        />

        {/* The money itself, moving. Each leg fires after the one before it, so
            the eye is carried from the subject out to the exit. */}
        {LIT.slice(0, -1).map((n, i) => {
          const next = LIT[i + 1];
          const d = `M ${n.x} ${n.y} L ${next.x} ${next.y}`;
          const begin = `${i * 0.55}s`;
          const fast = i === 0;
          return (
            <circle
              key={`packet-${i}`}
              className="fx-packet"
              r={3.6}
              fill={fast ? "var(--color-suspicious)" : "var(--color-brass)"}
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
        x={302}
        y={160}
        className="font-label"
        fontSize={9}
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
            {/* A slow sonar on the two wallets that carry the argument. */}
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
                    "--fx-r1": `${n.r * 2.1}px`,
                    animationDelay: `${i * 900}ms`,
                  } as React.CSSProperties
                }
              />
            ) : null}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--color-surface-2)"
              stroke={anchor ? "var(--color-brass)" : "var(--color-brass-dim)"}
              strokeWidth={anchor ? 1.5 : 1}
            />
            <text
              x={n.x}
              y={n.y + (terminal ? 5 : 4)}
              textAnchor="middle"
              className="font-mono"
              fontSize={terminal ? 14 : n.r > 20 ? 11 : 9}
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
          x={556}
          y={250}
          width={192}
          height={30}
          fill="var(--color-surface-2)"
          stroke="var(--color-suspicious)"
          strokeWidth={1}
        />
        <rect
          x={569}
          y={261}
          width={8}
          height={8}
          transform="rotate(45 573 265)"
          fill="var(--color-suspicious)"
        />
        <text
          x={586}
          y={269}
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
