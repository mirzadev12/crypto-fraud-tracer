import { NextResponse } from "next/server";
import { buildRegister } from "@/lib/register";

/**
 * GET /api/register — the case register as this server has read it: saved
 * cases, the traces it answered, and the recorded wallets re-read live
 * (lib/register.ts). Reads the server's own files only, never the chain.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildRegister(), { headers: { "Cache-Control": "no-store" } });
}
