import { NextResponse } from "next/server";
import { auditText, readAudit } from "@/lib/audit-store";

/**
 * GET /api/audit — the audit log, and whether its chain is intact.
 *
 *   ?limit=N         the latest N entries, newest first (default 100, at most 1000)
 *   ?format=jsonl    the file exactly as written, one entry per line, to check
 *                    anywhere else — `node scripts/verify-audit.mjs <file>`
 *                    imports nothing from this repository.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("format") === "jsonl") {
      return new NextResponse(await auditText(), {
        headers: {
          ...NO_STORE,
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Content-Disposition": 'attachment; filename="finex-audit.jsonl"',
        },
      });
    }
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const { entries, check } = await readAudit();
    return NextResponse.json(
      { check, entries: entries.slice(-limit).reverse() },
      { headers: NO_STORE },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `The audit log could not be read: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 503, headers: NO_STORE },
    );
  }
}
