import { labelWallet } from "./labels";
import type { TraceNode } from "./types";

export function findTerminalAttribution(
  nodes: TraceNode[]
) {
  const candidates = nodes
    .filter((node) => node.depth > 0)
    .map((node) => {
      const result = labelWallet(node.address);

      return {
        node,
        result,
      };
    })
    .filter(({ result }) => {
      return (
        result.kind === "exchange_deposit" ||
        result.kind === "exchange_hot"
      );
    });

  if (candidates.length === 0) {
    return undefined;
  }

  // Prefer the deepest identified exchange-related wallet.
  candidates.sort(
    (a, b) => b.node.depth - a.node.depth
  );

  const selected = candidates[0];

  if (!selected.result.label) {
    return undefined;
  }

  return {
    address: selected.node.address,
    entity: selected.result.label.entity,
    type: selected.result.label.type,
    confidence: selected.result.label.confidence,
  };
}