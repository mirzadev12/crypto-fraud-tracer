import { Panel } from "./ui";

/**
 * The clustering rule, drawn: unrelated payers pay into customer deposit
 * addresses, and each deposit address sweeps what it received into one
 * explorer-tagged exchange wallet. That pattern is how every derived row on
 * this page was found, so the picture is the method, not an illustration of it.
 *
 * A schematic of the rule only — no address and no amount appears in it, the
 * same safeguard as the landing hero. Packets travel the edges with SMIL, as on
 * every canvas here: payers first, then the sweep, staggered so the eye follows
 * the money left to right. `fx-packet` removes them under reduced motion and
 * leaves the drawing. Colours are the theme tokens as utilities, so a palette
 * change reaches this file without a hex literal to forget.
 */

const DEPOSITS: [number, number][] = [
  [470, 64],
  [470, 150],
  [470, 236],
];
const HOT: [number, number] = [868, 150];
/** Three unrelated payers per deposit address. */
const PAYERS: [number, number, number][] = [
  [60, 28, 0],
  [96, 64, 0],
  [60, 100, 0],
  [96, 128, 1],
  [60, 160, 1],
  [96, 190, 1],
  [60, 214, 2],
  [96, 244, 2],
  [60, 274, 2],
];

function curve([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export default function SweepDiagram({
  derived,
  seeds,
  exchanges,
}: {
  derived: number;
  seeds: number;
  exchanges: number;
}) {
  const payerEdges = PAYERS.map(([x, y, d]) => curve([x, y], DEPOSITS[d]));
  const sweepEdges = DEPOSITS.map((p) => curve(p, HOT));
  return (
    <Panel title="The rule, drawn" framed={false} className="mt-10">
      <svg
        viewBox="0 0 960 300"
        className="block h-auto w-full"
        role="img"
        aria-label="Unrelated payers send to customer deposit addresses; each deposit address forwards what it received to one explorer-tagged exchange wallet."
      >
        {payerEdges.map((d, i) => (
          <path key={`pe${i}`} d={d} className="fill-none stroke-line" strokeWidth={1} />
        ))}
        {sweepEdges.map((d, i) => (
          <path key={`se${i}`} d={d} className="fill-none stroke-brass-dim" strokeWidth={1.5} />
        ))}

        {/* The money moving: in from the payers, then swept to the exchange. */}
        {payerEdges.map((d, i) => (
          <circle key={`pp${i}`} r={2.5} className="fx-packet fill-faint">
            <animateMotion dur="2.4s" begin={`${(i % 3) * 0.5}s`} repeatCount="indefinite" path={d} />
          </circle>
        ))}
        {sweepEdges.map((d, i) => (
          <circle key={`sp${i}`} r={3.5} className="fx-packet fill-brass">
            <animateMotion
              dur="2.4s"
              begin={`${1.2 + i * 0.4}s`}
              repeatCount="indefinite"
              path={d}
              calcMode="spline"
              keyPoints="0;1"
              keyTimes="0;1"
              keySplines="0.45 0 0.55 1"
            />
          </circle>
        ))}

        {PAYERS.map(([x, y], i) => (
          <circle key={`p${i}`} cx={x} cy={y} r={4} className="fill-dim" />
        ))}
        {DEPOSITS.map(([x, y], i) => (
          <circle key={`d${i}`} cx={x} cy={y} r={10} className="fill-surface stroke-brass" strokeWidth={1.5} />
        ))}
        {/* The exchange wallet in the house mark: the brass lozenge. */}
        <rect
          x={HOT[0] - 15}
          y={HOT[1] - 15}
          width={30}
          height={30}
          transform={`rotate(45 ${HOT[0]} ${HOT[1]})`}
          className="fill-brass"
        />
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-4 text-xs leading-5">
        <div>
          <p className="font-label uppercase tracking-[0.18em] text-muted">Unrelated payers</p>
          <p className="text-faint">Customers paying in, who share nothing with each other.</p>
        </div>
        <div className="text-center">
          <p className="font-label uppercase tracking-[0.18em] text-brass">Customer deposit address</p>
          <p className="text-faint">Forwards 90% or more of what it receives, in two or more sweeps.</p>
        </div>
        <div className="text-right">
          <p className="font-label uppercase tracking-[0.18em] text-muted">Tagged exchange wallet</p>
          <p className="text-faint">Named by a public block explorer: the ground truth.</p>
        </div>
      </div>
      <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
        An exchange gives every customer their own deposit address and later sweeps it into its hot
        wallet. So an address that keeps forwarding almost everything it receives to one tagged
        exchange wallet is a customer account at that exchange — the account the exchange can
        identify and freeze. Applied to {seeds} tagged wallets on TRON, the rule found {derived}{" "}
        such addresses across {exchanges} exchanges. Each is a lead with stated confidence, not
        proof of ownership.
      </p>
    </Panel>
  );
}
