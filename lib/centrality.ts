/**
 * Which wallet is the actual bottleneck.
 *
 * The leads engine used to answer this with "whichever holds the most tainted
 * money", and that is not the same question. Money and position are different
 * properties: a wallet can hold very little at any moment and still be the
 * address every route has to cross. Identify that one and the whole case is
 * covered; identify the richest one and you may have identified a leaf.
 *
 *     victim ─▶ A ─┐
 *                  ├─▶ C ─▶ exchange
 *     victim ─▶ B ─┘
 *
 * C may never hold much. Nothing gets out without it.
 *
 * Betweenness centrality is the standard measure of exactly that: for every
 * pair of wallets, take the shortest routes between them and count how many
 * pass through each other wallet. The one lying on the most routes is the most
 * "between" — the bridge in a road network rather than the biggest town.
 *
 * Implemented as Brandes' algorithm, which is the reason this is tractable at
 * all: the naive form enumerates every path between every pair and costs
 * O(n³), while Brandes accumulates dependencies backwards over a BFS from each
 * source and costs O(nm) on an unweighted graph. On a trace of a few dozen
 * wallets either would finish, but the batch canvas unions ten complaints and
 * the naive version starts to be felt there.
 *
 * Unweighted on purpose. Weighting the edges by value would answer "where did
 * the most money flow", which `taintedValueUsdt` already answers on every node
 * — and mixing the two produces a figure that is neither, which is worse than
 * either. This measures position. The leads engine states both.
 *
 * Reference: Brandes, "A Faster Algorithm for Betweenness Centrality" (2001).
 */

export interface CentralityEdge {
  from: string;
  to: string;
}

/**
 * Address → betweenness score, normalised to 0..1 against the highest scorer.
 *
 * Normalised rather than raw because the raw number has no meaning to a reader
 * — it is a count of shortest paths, which scales with the size of the graph.
 * "This wallet sits on the most routes, and the next one on 40% as many" is a
 * sentence an investigator can use.
 */
export function betweenness(
  nodes: string[],
  edges: CentralityEdge[],
): Map<string, number> {
  const score = new Map<string, number>(nodes.map((n) => [n, 0]));
  if (nodes.length < 3) return score;

  const adjacency = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    if (!adjacency.has(e.from) || !adjacency.has(e.to)) continue;
    // Directed: money flows one way, and a bottleneck on the route out is not
    // the same wallet as a bottleneck on the way in.
    adjacency.get(e.from)!.push(e.to);
  }

  for (const source of nodes) {
    /* Brandes, one source at a time: a BFS forward accumulating how many
       shortest paths reach each wallet, then a walk back down the stack
       accumulating how much each wallet is depended upon. */
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(nodes.map((n) => [n, []]));
    const pathCount = new Map<string, number>(nodes.map((n) => [n, 0]));
    const distance = new Map<string, number>(nodes.map((n) => [n, -1]));

    pathCount.set(source, 1);
    distance.set(source, 0);

    const queue: string[] = [source];
    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adjacency.get(v) ?? []) {
        if (distance.get(w)! < 0) {
          distance.set(w, distance.get(v)! + 1);
          queue.push(w);
        }
        // Another shortest path to w, by way of v.
        if (distance.get(w) === distance.get(v)! + 1) {
          pathCount.set(w, pathCount.get(w)! + pathCount.get(v)!);
          predecessors.get(w)!.push(v);
        }
      }
    }

    const dependency = new Map<string, number>(nodes.map((n) => [n, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of predecessors.get(w)!) {
        const share =
          (pathCount.get(v)! / pathCount.get(w)!) * (1 + dependency.get(w)!);
        dependency.set(v, dependency.get(v)! + share);
      }
      if (w !== source) score.set(w, score.get(w)! + dependency.get(w)!);
    }
  }

  const highest = Math.max(...score.values(), 0);
  if (highest <= 0) return score;
  for (const [address, value] of score) score.set(address, value / highest);
  return score;
}
