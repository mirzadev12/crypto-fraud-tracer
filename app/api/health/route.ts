import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/demo";
import { readSources } from "@/lib/endpoints";

/**
 * GET /api/health — is this deployment set up the way the demo needs?
 *
 * Three questions otherwise answerable only from the hosting dashboard, which
 * not everyone on the team can open: which commit is serving, whether demo mode
 * is on, and whether chain reads carry an API key. The key itself is never
 * returned — only whether one is present.
 *
 * Cheap on purpose: no chain read and no page render, so an uptime monitor can
 * call it every few minutes to keep a sleeping free instance awake.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      // Render sets this for services built from Git; null anywhere else.
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      demoMode: DEMO_MODE,
      chainAccess: process.env.TRONGRID_API_KEY ? "keyed" : "public",
      // The same question for Ethereum reads. Never the key.
      ethereumAccess: process.env.BLOCKSCOUT_API_KEY ? "keyed" : "public",
      // Where each kind of chain read goes: the agency's own endpoint ("own"),
      // a public one, a setting that is not a URL, or not made at all. Never
      // the address itself (lib/endpoints.ts).
      reads: readSources(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
