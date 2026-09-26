import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { appendAudit, findTrace } from "@/lib/audit-store";
import { addCase, caseFromEntry } from "@/lib/case-file";
import { changeCases, loadCases } from "@/lib/case-store";
import { actorOf } from "@/lib/identity";

/**
 * /api/cases — the shared case file. AGENTS.md §5 names `GET /api/cases` →
 * `CaseSummary[]`; each saved case is one, with where it came from beside it.
 *
 *   GET     every case saved on this server, most actionable first.
 *   POST    { address, fingerprint } — save the run this server traced with
 *           that findings fingerprint. The case is built from the server's own
 *           audit record of the trace, never from the request, so a run the
 *           server did not trace cannot be saved (404).
 *   DELETE  { id } — take a case out of the file.
 *
 * Saving and removing are both written to the audit log with who did them.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function failed(err: unknown) {
  const why = err instanceof Error ? err.message : "its storage could not be used";
  return NextResponse.json(
    { error: `This server cannot keep a case file: ${why}` },
    { status: 503, headers: NO_STORE },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await loadCases(), { headers: NO_STORE });
  } catch (err) {
    return failed(err);
  }
}

export async function POST(request: Request) {
  type Body = { address?: unknown; fingerprint?: unknown } | null;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = null;
  }
  const check = checkAddress(typeof body?.address === "string" ? body.address : "");
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint.trim().toLowerCase() : "";
  if (!check.valid || !/^[0-9a-f]{64}$/.test(fingerprint)) {
    return NextResponse.json(
      { error: "Expected { address, fingerprint } — a valid address and the run's findings fingerprint." },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const traced = await findTrace(check.address, fingerprint);
    if (!traced) {
      return NextResponse.json(
        { error: "This server has no record of tracing that run, so it cannot be saved here. Trace it on this server first." },
        { status: 404, headers: NO_STORE },
      );
    }
    const actor = actorOf(request.headers);
    const saved = caseFromEntry(traced, actor, new Date().toISOString());
    if (!saved) {
      return NextResponse.json({ error: "That record is not a trace that can be saved." }, { status: 422, headers: NO_STORE });
    }
    const result = await changeCases((cases) => addCase(cases, saved));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503, headers: NO_STORE });
    if (!result.already) {
      await appendAudit({
        action: "case.saved",
        actor,
        chain: saved.chain,
        address: saved.inputAddress,
        detail: { caseId: saved.caseId, fromEntry: saved.entry, fingerprint: saved.fingerprint, triage: saved.triage },
      });
    }
    return NextResponse.json(
      { ok: true, already: result.already, case: result.case },
      { status: result.already ? 200 : 201, headers: NO_STORE },
    );
  } catch (err) {
    return failed(err);
  }
}

export async function DELETE(request: Request) {
  let id: unknown;
  try {
    id = ((await request.json()) as { id?: unknown })?.id;
  } catch {
    id = undefined;
  }
  if (typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id)) {
    return NextResponse.json({ error: "Expected { id }." }, { status: 400, headers: NO_STORE });
  }
  try {
    const removed = await changeCases((cases) => {
      const at = cases.findIndex((c) => c.id === id);
      return at < 0 ? null : cases.splice(at, 1)[0];
    });
    if (removed) {
      await appendAudit({
        action: "case.removed",
        actor: actorOf(request.headers),
        chain: removed.chain,
        address: removed.inputAddress,
        detail: { caseId: removed.caseId, fromEntry: removed.entry, fingerprint: removed.fingerprint },
      });
    }
    return NextResponse.json({ ok: true, removed: !!removed }, { headers: NO_STORE });
  } catch (err) {
    return failed(err);
  }
}
