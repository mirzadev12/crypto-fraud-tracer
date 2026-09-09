import { traceWallet } from "@/lib/tracer";

export async function GET() {
  try {
    const result = await traceWallet(
  "TJmmqjb1DK9TTZbQXzRQ2AuA94z4gKAPFh",
  30.716426,
  "2021-03-27"
);

    return Response.json({
      success: true,
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      nodes: result.nodes,
      edges: result.edges,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}