import { getUsdtTransfers } from "@/lib/trongrid";

export async function GET() {
  try {
    const result = await getUsdtTransfers(
      "TJmmqjb1DK9TTZbQXzRQ2AuA94z4gKAPFh",
      {
        onlyConfirmed: true,
        limit: 10,
      }
    );

    return Response.json({
      success: true,
      count: result.data.length,
      data: result.data,
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