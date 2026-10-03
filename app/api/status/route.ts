import { NextResponse } from "next/server";
import { readStatus } from "@/lib/status";

/**
 * GET /api/status — each chain's newest block, read now, and what this server
 * has answered today. Reads no wallet; kept 30 seconds server-side
 * (lib/status.ts), so polling it is cheap.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await readStatus();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
