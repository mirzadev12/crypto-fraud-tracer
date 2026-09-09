export type TriageLevel = "HOT" | "WARM" | "COLD";

export type LabelSource =
  | "ground_truth"
  | "heuristic"
  | "sanctions"
  | "community";

export type NodeKind =
  | "victim_reported"
  | "intermediary"
  | "exchange_deposit"
  | "exchange_hot"
  | "mixer"
  | "sanctioned"
  | "unknown";

export type Label = {
  entity: string;
  type: string;
  source: LabelSource;
  confidence: number;
};

export type TraceNode = {
  address: string;
  kind: NodeKind;
  label?: Label;
  depth: number;
  amountIn: number;
  amountOut: number;
  confidence?: number;
  riskFlags?: string[];
};

export type TraceEdge = {
  from: string;
  to: string;
  amount: number;
  token: "USDT";
  txHash: string;
  timestamp: string;
};

export type RiskFlag = {
  rule: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type TraceResult = {
  chain: "tron";
  reportedAmountUsdt: number;
  fraudDate: string;

  nodes: TraceNode[];
  edges: TraceEdge[];

  terminal?: {
    address: string;
    entity: string;
    type: string;
    confidence: number;
  };

  riskFlags: RiskFlag[];

  triage: TriageLevel;
  triageReason: string;

  provenance: {
    apiCallCount: number;
    responseHashes: string[];
  };
};

export type CaseSummary = {
  id: string;
  address: string;
  amount: number;
  fraudDate: string;
  triage: TriageLevel;
  status: "NEW" | "ANALYZED";
  terminalEntity?: string;
};