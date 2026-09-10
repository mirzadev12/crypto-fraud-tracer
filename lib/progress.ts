/**
 * Live progress from a running trace.
 *
 * Pure types, deliberately in their own file: the tracer emits these on the
 * server and the interface renders them in the browser, and neither side should
 * pull the other's code into its bundle to agree on a shape.
 *
 * Every event is something the tracer actually did, emitted at the moment it
 * did it — a wallet read from the chain, a hop reached, an attribution matched.
 * None of it is timed or staged.
 */
export type TraceProgress =
  | {
      type: "start";
      address: string;
      /** "auto" when the caller gave no amount. */
      amount: number | "auto";
      /** ISO timestamp, or "auto" when the caller gave no fraud date. */
      window: string;
    }
  /** An "auto" window resolved from the subject's own first transfer. */
  | { type: "window"; since: string }
  | { type: "hop"; depth: number; wallets: number }
  | {
      type: "read";
      address: string;
      depth: number;
      transfers: number;
      outflows: number;
      apiCalls: number;
    }
  | {
      type: "label";
      address: string;
      depth: number;
      entity: string;
      kind: string;
      source: string;
    }
  | { type: "scoring"; wallets: number; transfers: number }
  /** Demo mode answered from the frozen case file instead of the chain. */
  | { type: "recorded"; caseId: string };
