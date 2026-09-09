import { getUsdtTransfers } from "./trongrid";
import { labelWallet } from "./labels";
import type { TraceEdge, TraceNode } from "./types";

const MAX_DEPTH = 3;
const MAX_OUTFLOWS_PER_WALLET = 5;
const MIN_TAINT_PERCENT = 0.01;

function toUsdt(value: string, decimals = 6): number {
  const amount = Number(value) / 10 ** decimals;

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount;
}

export async function traceWallet(
  startAddress: string,
  reportedAmountUsdt: number,
  fraudDate: string
): Promise<{
  nodes: TraceNode[];
  edges: TraceEdge[];
  provenance: {
    apiCallCount: number;
    responseHashes: string[];
  };
}> {
  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];

  let apiCallCount = 0;
const responseHashes: string[] = [];

  const fraudTimestamp = new Date(fraudDate).getTime();

  if (!Number.isFinite(fraudTimestamp)) {
    throw new Error("Invalid fraud date");
  }

  if (
    !Number.isFinite(reportedAmountUsdt) ||
    reportedAmountUsdt <= 0
  ) {
    throw new Error("Invalid reported amount");
  }

  const queue: Array<{
    address: string;
    depth: number;
    taintedAmount: number;
    receivedAt: number;
  }> = [
    {
      address: startAddress,
      depth: 0,
      taintedAmount: reportedAmountUsdt,
      receivedAt: fraudTimestamp,
    },
  ];

  const visited = new Set<string>();

  const startLabel = labelWallet(startAddress);

nodes.set(startAddress, {
  address: startAddress,
  kind: "victim_reported",
  label: startLabel.label,
  depth: 0,
  amountIn: 0,
  amountOut: 0,
});

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const {
      address,
      depth,
      taintedAmount,
      receivedAt,
    } = current;

    if (visited.has(address)) {
      continue;
    }

    visited.add(address);

    if (depth >= MAX_DEPTH) {
      continue;
    }

    const result = await getUsdtTransfers(address, {
      onlyConfirmed: true,
      onlyFrom: true,

      // Only examine transfers after the wallet
      // received the funds we are tracing.
      minTimestamp: receivedAt,

      limit: 200,
    });

    apiCallCount += result.provenance.apiCallCount;
responseHashes.push(...result.provenance.responseHashes);

    const minimumRelevantAmount =
      taintedAmount * MIN_TAINT_PERCENT;

    const candidates = result.data
      .map((transfer) => ({
        transfer,
        amount: toUsdt(
          transfer.value,
          transfer.token_info.decimals
        ),
      }))
      .filter(({ transfer, amount }) => {
        if (transfer.from !== address) {
          return false;
        }

        if (!transfer.to || transfer.to === address) {
          return false;
        }

        if (amount <= 0) {
          return false;
        }

        // Ignore tiny/dust transfers.
        if (amount < minimumRelevantAmount) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Prefer transfers that are closest to
        // the amount currently being traced.
        const aDifference = Math.abs(
          a.amount - taintedAmount
        );

        const bDifference = Math.abs(
          b.amount - taintedAmount
        );

        return aDifference - bDifference;
      })
      .slice(0, MAX_OUTFLOWS_PER_WALLET);

    let remainingTaint = taintedAmount;

    for (const { transfer, amount } of candidates) {
      if (remainingTaint <= 0) {
        break;
      }

      const destination = transfer.to;

      if (!destination) {
        continue;
      }

      /*
       * If a wallet sends more USDT than the tainted amount,
       * only the portion relevant to our investigation is
       * represented in the graph.
       */
      const tracedAmount = Math.min(
        amount,
        remainingTaint
      );

      if (tracedAmount <= 0) {
        continue;
      }

      remainingTaint -= tracedAmount;

      edges.push({
        from: address,
        to: destination,
        amount: tracedAmount,
        token: "USDT",
        txHash: transfer.transaction_id,
        timestamp: new Date(
          transfer.block_timestamp
        ).toISOString(),
      });

      const existingNode = nodes.get(destination);

      if (!existingNode) {
  const walletLabel = labelWallet(destination);

  nodes.set(destination, {
    address: destination,
    kind: walletLabel.kind,
    label: walletLabel.label,
    depth: depth + 1,
    amountIn: tracedAmount,
    amountOut: 0,
  });
} else {
        existingNode.amountIn += tracedAmount;
      }

      const sourceNode = nodes.get(address);

      if (sourceNode) {
        sourceNode.amountOut += tracedAmount;
      }

      if (!visited.has(destination)) {
        queue.push({
          address: destination,
          depth: depth + 1,
          taintedAmount: tracedAmount,

          // The next wallet's tracing starts
          // from the time it received the funds.
          receivedAt: transfer.block_timestamp,
        });
      }
    }
  }

  return {
  nodes: Array.from(nodes.values()),
  edges,
  provenance: {
    apiCallCount,
    responseHashes,
  },
};
}