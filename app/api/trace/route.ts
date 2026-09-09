import { traceWallet } from "@/lib/tracer";
import { analyzeRisk } from "@/lib/risk";
import { findTerminalAttribution } from "@/lib/attribution";
import { trace } from "next/dist/trace/trace";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { address, amount, fraudDate } = body;

    if (!address || typeof address !== "string") {
      return Response.json(
        { error: "Valid wallet address is required" },
        { status: 400 }
      );
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return Response.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (!fraudDate || typeof fraudDate !== "string") {
      return Response.json(
        { error: "Valid fraud date is required" },
        { status: 400 }
      );
    }

    const trace = await traceWallet(
      address,
      amount,
      fraudDate
    );

    const risk = analyzeRisk(trace.nodes);
    const terminal = findTerminalAttribution(trace.nodes);

    return Response.json({
      chain: "tron",
      reportedAmountUsdt: amount,
      fraudDate,

      nodes: trace.nodes,
      edges: trace.edges,

riskFlags: risk.riskFlags,
triage: risk.triage,
triageReason: risk.triageReason,
terminal,

     provenance: trace.provenance,
    });
  } catch (error) {
    console.error("Trace API error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}