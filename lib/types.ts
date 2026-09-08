// FROZEN CONTRACT — see AGENTS.md §5.
// The frontend builds against this file. Do not change a field name or a type
// after hour one. Add nothing here without telling the whole team first.

export type TriageLevel = "HOT" | "WARM" | "COLD";
export type LabelSource = "ground_truth" | "heuristic" | "sanctions" | "community";
export type NodeKind   = "victim_reported" | "intermediary" | "exchange_deposit"
                       | "exchange_hot" | "mixer" | "sanctioned" | "unknown";

export interface Label {
  entity: string;              // "Binance"
  kind: NodeKind;
  confidence: number;          // 0..1
  source: LabelSource;
  evidence?: string;           // "12 sweeps observed to hot wallet TXY..."
}

export interface TraceNode {
  address: string;
  depth: number;
  label: Label | null;
  taintedValueUsdt: number;    // victim money reaching this node
  taintFraction: number;       // 0..1
  firstSeen: string | null;    // ISO
  outflowCount: number;
}

export interface TraceEdge {
  from: string;
  to: string;
  valueUsdt: number;
  txHash: string;
  timestamp: string;           // ISO
  dwellSeconds: number | null; // time held before forwarding
}

export interface RiskFlag {
  code: "SHORT_DWELL" | "HIGH_FANOUT" | "PEEL_CHAIN"
      | "ROUND_AMOUNTS" | "NEW_ADDRESS" | "SANCTIONED_CONTACT";
  reason: string;              // plain English, shown verbatim in the UI
  atAddress: string;
}

export interface TraceResult {
  caseId: string;
  inputAddress: string;
  chain: "tron";
  reportedAmountUsdt: number;
  fraudDate: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  terminal: {
    address: string;
    label: Label;
    depositAddress: string | null;   // ← the money slide
  } | null;
  riskFlags: RiskFlag[];
  triage: TriageLevel;
  triageReason: string;
  narrative?: string;                // optional LLM summary, see AGENTS.md §11
  provenance: {
    apiCalls: number;
    responseHashes: string[];        // sha256 per API response
    generatedAt: string;
  };
}

export interface CaseSummary {
  caseId: string;
  inputAddress: string;
  reportedAmountUsdt: number;
  fraudDate: string;
  triage: TriageLevel;
  terminalEntity: string | null;
}
