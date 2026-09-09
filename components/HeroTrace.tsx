/**
 * The hero visual: a trace, resolving.
 *
 * The landing page's job is to show what the instrument does, so the strongest
 * image available is the product's own output rather than an ornament. This is
 * a schematic of the shape every case takes — subject wallet, hops carrying a
 * falling share of the victim's money, a branch dropped as dust, and an exit —
 * drawn in the same language the real canvases use.
 *
 * Deliberately carries **no addresses and no amounts**. Every figure on it is
 * either a taint percentage, which is a concept rather than a claim, or a rule
 * the pipeline actually applies. Putting an invented address on the front page
 * would be the one thing this tool cannot afford to look like it does.
 *
 * Pure markup: no state, no effects, no dependency. The motion is the existing
 * `fx-flow` and `fx-settle` utilities, both already switched off under
 * `prefers-reduced-motion`.
 */

/** A wallet, drawn as a block: header band, rule, and hash bars. */
function Block({
  x,
  y,
  size,
  taint,
  role,
  labelY,
  tone = "line",
  delay = 0,
}: {
  x: number;
  y: number;
  size: number;
  taint: string;
  role: string;
  /** Shared baseline for the row, so blocks of different sizes stay tidy. */
  labelY?: number;
  /** `line` is an ordinary hop; `brass` marks the subject and the exit. */
  tone?: "line" | "brass" | "dim";
  delay?: number;
}) {
  const stroke =
    tone === "brass"
      ? "var(--color-brass)"
      : tone === "dim"
        ? "var(--color-dim)"
        : "var(--color-line)";
  const head = size * 0.3;
  // Ragged bar lengths, fixed rather than random so the plate never reshuffles.
  const bars = [0.68, 0.44, 0.56];

  return (
    <g className="fx-settle" style={{ animationDelay: `${delay}ms` }}>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        fill="var(--color-surface)"
        stroke={stroke}
        strokeWidth={1}
      />
      {/* Header band, closed by a rule — the block's identity strip. */}
      <rect
        x={x + 1}
        y={y + 1}
        width={size - 2}
        height={head}
        fill="var(--color-surface-2)"
      />
      <line
        x1={x}
        y1={y + head}
        x2={x + size}
        y2={y + head}
        stroke={stroke}
        strokeWidth={1}
      />
      <text
        x={x + size / 2}
        y={y + head - head * 0.3}
        textAnchor="middle"
        className="font-mono"
        fontSize={size > 90 ? 13 : size > 60 ? 11 : 8}
        fill={tone === "brass" ? "var(--color-brass)" : "var(--color-muted)"}
      >
        {taint}
      </text>

      {/* Hash bars: the records inside. Abstract on purpose. */}
      {bars.map((run, i) => (
        <line
          key={i}
          x1={x + size * 0.16}
          y1={y + head + (size - head) * (0.28 + i * 0.24)}
          x2={x + size * 0.16 + (size * 0.68) * run}
          y2={y + head + (size - head) * (0.28 + i * 0.24)}
          stroke="var(--color-dim)"
          strokeWidth={1}
        />
      ))}

      <text
        x={x + size / 2}
        y={labelY ?? y + size + 18}
        textAnchor="middle"
        className="font-label"
        fontSize={9}
        letterSpacing="0.18em"
        fill={tone === "dim" ? "var(--color-dim)" : "var(--color-faint)"}
      >
        {role}
      </text>
    </g>
  );
}

/** A transfer. `flagged` draws the sub-ten-minute rule in suspicious amber. */
function Link({
  x1,
  x2,
  y,
  flagged = false,
  dim = false,
  delay = 0,
}: {
  x1: number;
  x2: number;
  y: number;
  flagged?: boolean;
  dim?: boolean;
  delay?: number;
}) {
  const stroke = flagged
    ? "var(--color-suspicious)"
    : dim
      ? "var(--color-dim)"
      : "var(--color-brass-dim)";
  return (
    <g style={{ animationDelay: `${delay}ms` }} className="fx-settle">
      <line
        x1={x1}
        y1={y}
        x2={x2 - 7}
        y2={y}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="4 6"
        className="fx-flow"
      />
      <path
        d={`M ${x2 - 7} ${y - 4} L ${x2} ${y} L ${x2 - 7} ${y + 4} Z`}
        fill={stroke}
      />
    </g>
  );
}

export default function HeroTrace() {
  const axis = 190;

  return (
    <svg
      viewBox="0 118 760 246"
      className="h-auto w-full"
      role="img"
      aria-label="Schematic of a trace: a victim-reported wallet, two hops carrying a falling share of the stolen funds, a branch dropped as dust, and an exit at an exchange deposit cluster."
    >
      {/* The subject. Brass, because the case starts here. */}
      <Block x={40} y={142} size={96} taint="100%" role="SUBJECT" tone="brass" labelY={272} />
      <Link x1={136} x2={236} y={axis} flagged delay={120} />
      <text
        x={186}
        y={axis - 14}
        textAnchor="middle"
        className="font-label"
        fontSize={9}
        letterSpacing="0.16em"
        fill="var(--color-suspicious)"
      >
        &lt; 10 MIN
      </text>

      <Block x={236} y={150} size={80} taint="71%" role="HOP 1" labelY={272} delay={120} />
      <Link x1={316} x2={416} y={axis} delay={240} />

      <Block x={416} y={154} size={72} taint="64%" role="HOP 2" labelY={272} delay={240} />
      <Link x1={488} x2={588} y={axis} delay={360} />

      {/* The branch the tracer drops: below 1% of the reported amount. */}
      <g className="fx-settle" style={{ animationDelay: "180ms" }}>
        <path
          d={`M 276 230 L 276 312 L 323 312`}
          fill="none"
          stroke="var(--color-dim)"
          strokeWidth={1}
          strokeDasharray="4 6"
        />
        <path d="M 323 308 L 330 312 L 323 316 Z" fill="var(--color-dim)" />
      </g>
      <Block x={330} y={290} size={44} taint="0.4%" role="DUST · DROPPED" tone="dim" delay={300} />

      {/* The exit. The largest thing on the diagram, because it is the answer. */}
      <Block x={588} y={132} size={116} taint="58%" role="EXIT" tone="brass" labelY={272} delay={360} />
      <g className="fx-settle" style={{ animationDelay: "480ms" }}>
        <rect
          x={556}
          y={292}
          width={188}
          height={30}
          fill="var(--color-surface-2)"
          stroke="var(--color-suspicious)"
          strokeWidth={1}
        />
        <rect x={569} y={303} width={8} height={8} transform="rotate(45 573 307)" fill="var(--color-suspicious)" />
        <text
          x={586}
          y={311}
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
