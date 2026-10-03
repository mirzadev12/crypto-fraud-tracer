import { test } from "node:test";
import assert from "node:assert/strict";
import { featureRows, isolationScores, rankAnomalies } from "../lib/anomaly.ts";

test("a clear outlier is isolated more easily than the cluster it sits apart from", () => {
  const cluster = Array.from({ length: 40 }, (_, i) => [1 + (i % 5) * 0.01, 2 + (i % 7) * 0.01]);
  const outlier = [9, -6];
  const [inlier, odd] = isolationScores([...cluster, outlier], [cluster[3], outlier]);
  assert.ok(odd > 0.6, `outlier scored ${odd}`);
  assert.ok(odd > inlier + 0.15, `outlier ${odd} vs inlier ${inlier}`);
});

test("the same input always gets the same scores", () => {
  const rows = Array.from({ length: 30 }, (_, i) => [Math.sin(i), Math.cos(i * 1.7), i % 3]);
  assert.deepEqual(isolationScores(rows, rows), isolationScores(rows, rows));
});

const at = (min) => new Date(Date.UTC(2026, 8, 1, 10, min)).toISOString();
const trace = {
  caseId: "FX-TEST",
  inputAddress: "S",
  chain: "tron",
  reportedAmountUsdt: 10000,
  fraudDate: at(0),
  nodes: [
    { address: "S", depth: 0, label: null, taintedValueUsdt: 10000, taintFraction: 1, firstSeen: at(0), outflowCount: 2 },
    { address: "A", depth: 1, label: null, taintedValueUsdt: 9000, taintFraction: 0.9, firstSeen: at(1), outflowCount: 1 },
    { address: "B", depth: 1, label: null, taintedValueUsdt: 1000, taintFraction: 0.1, firstSeen: null, outflowCount: 0 },
    {
      address: "X",
      depth: 2,
      label: { entity: "Binance", kind: "exchange_hot", confidence: 1, source: "ground_truth" },
      taintedValueUsdt: 9000,
      taintFraction: 0.9,
      firstSeen: null,
      outflowCount: 0,
    },
  ],
  edges: [
    { from: "S", to: "A", valueUsdt: 9000, txHash: "1", timestamp: at(1), dwellSeconds: 60 },
    { from: "S", to: "B", valueUsdt: 1000, txHash: "2", timestamp: at(2), dwellSeconds: 120 },
    { from: "A", to: "X", valueUsdt: 9000, txHash: "3", timestamp: at(3), dwellSeconds: 120 },
  ],
  terminal: null,
  riskFlags: [],
  triage: "WARM",
  triageReason: "",
  provenance: { apiCalls: 1, responseHashes: [], generatedAt: at(30) },
};

test("only unlabelled wallets past the reported one are ranked", () => {
  const rows = featureRows(trace);
  assert.deepEqual(rows.map((r) => r.address), ["A", "B"]);
  // B sent nothing: no forward time and no pass-through to measure.
  const b = rows.find((r) => r.address === "B").row;
  assert.equal(b[2], null);
  assert.equal(b[3], null);
});

test("ranking is deterministic and says how many wallets it was trained on", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => [5 + i * 0.1, 1, 3, 1, 0, 0.7, 2, 0.2]);
  const one = rankAnomalies(trace, baseline);
  const two = rankAnomalies(trace, baseline);
  assert.deepEqual(one, two);
  assert.equal(one.baseline, 12);
  assert.equal(one.trainedOn, 14);
  assert.equal(one.scored.length, 2);
  for (const s of one.scored) assert.ok(s.score > 0 && s.score < 1);
});
