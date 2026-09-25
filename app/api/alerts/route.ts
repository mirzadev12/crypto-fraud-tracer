import { NextResponse } from "next/server";
import { checkSoon, startAlertLoop } from "@/lib/alert-loop";
import { loadState, mutate, vapidKeys } from "@/lib/alert-store";
import { CHECK_EVERY_MINUTES, readSync, removeSubscription, upsert } from "@/lib/alerts";

/**
 * /api/alerts — alerts when the desk is closed.
 *
 *   GET     whether this server can keep a watch, the public key a browser
 *           subscribes with, and when it last checked.
 *   POST    { subscription, items } — a browser hands over its whole watch
 *           list; sent again on every change and whenever its desk opens.
 *   DELETE  { endpoint } — that browser no longer wants alerts.
 *
 * The browser owns the list; the server holds a copy in a file and checks it
 * every five minutes (`lib/alert-loop.ts`). Nothing here reads the chain.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function cannot(err: unknown) {
  const why = err instanceof Error ? err.message : "its storage could not be used";
  return NextResponse.json(
    { available: false, error: `This server cannot keep a watch: ${why}` },
    { status: 503, headers: NO_STORE },
  );
}

export async function GET() {
  startAlertLoop();
  try {
    const [keys, state] = await Promise.all([vapidKeys(), loadState()]);
    const last = state.lastRun ? Date.parse(state.lastRun.at) : Number.NaN;
    return NextResponse.json(
      {
        available: true,
        publicKey: keys.publicKey,
        everyMinutes: CHECK_EVERY_MINUTES,
        lastRun: state.lastRun,
        // Three rounds missed: the server was not running in between (a host
        // that sleeps when idle), so nothing was checked then.
        current:
          Number.isFinite(last) && Date.now() - last < 3 * CHECK_EVERY_MINUTES * 60_000,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return cannot(err);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400, headers: NO_STORE });
  }
  const sync = readSync(body);
  if ("error" in sync) {
    return NextResponse.json({ error: sync.error }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await mutate((state) =>
      upsert(state, sync.target, sync.items, new Date().toISOString()),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503, headers: NO_STORE });
    }
  } catch (err) {
    return cannot(err);
  }
  startAlertLoop();
  // The first answer for a new list comes within seconds, not at the next round.
  if (sync.items.length) checkSoon();
  return NextResponse.json({ ok: true, watching: sync.items.length }, { headers: NO_STORE });
}

export async function DELETE(request: Request) {
  let endpoint: unknown;
  try {
    endpoint = ((await request.json()) as { endpoint?: unknown })?.endpoint;
  } catch {
    endpoint = undefined;
  }
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ error: "Expected { endpoint }." }, { status: 400, headers: NO_STORE });
  }
  try {
    const removed = await mutate((state) => removeSubscription(state, endpoint));
    return NextResponse.json({ ok: true, removed }, { headers: NO_STORE });
  } catch (err) {
    return cannot(err);
  }
}
