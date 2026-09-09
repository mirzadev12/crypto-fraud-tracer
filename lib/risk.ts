import type { RiskFlag, TriageLevel, TraceNode } from "./types";

export function analyzeRisk(
  nodes: TraceNode[]
): {
  riskFlags: RiskFlag[];
  triage: TriageLevel;
  triageReason: string;
} {
  const riskFlags: RiskFlag[] = [];

  // Rule 1: Multi-hop movement
  const maxDepth = Math.max(
    ...nodes.map((node) => node.depth)
  );

  if (maxDepth >= 2) {
    riskFlags.push({
      rule: "MULTI_HOP_MOVEMENT",
      reason: `Funds moved through ${maxDepth} intermediary hops.`,
      severity: "MEDIUM",
    });
  }

  // Rule 2: Fund splitting
  const depthThreeNodes = nodes.filter(
    (node) => node.depth === 3
  );

  if (depthThreeNodes.length >= 2) {
    riskFlags.push({
      rule: "FUND_SPLITTING",
      reason: "Traced funds split across multiple destination wallets.",
      severity: "HIGH",
    });
  }

  // Calculate overall triage
  const hasHighRisk = riskFlags.some(
    (flag) => flag.severity === "HIGH"
  );

  const hasMediumRisk = riskFlags.some(
    (flag) => flag.severity === "MEDIUM"
  );

  if (hasHighRisk) {
    return {
      riskFlags,
      triage: "HOT",
      triageReason:
        "High-risk transaction patterns detected in the traced flow.",
    };
  }

  if (hasMediumRisk) {
    return {
      riskFlags,
      triage: "WARM",
      triageReason:
        "Suspicious multi-hop movement detected in the traced flow.",
    };
  }

  return {
    riskFlags,
    triage: "COLD",
    triageReason:
      "No high-risk transaction patterns detected.",
  };
}