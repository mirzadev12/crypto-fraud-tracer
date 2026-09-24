import { NextResponse } from "next/server";
import { checkAddress } from "@/lib/address";
import { EthClient } from "@/lib/ethclient";
import { lookup } from "@/lib/labels";
import { TronGrid } from "@/lib/trongrid";
import type { WatchResult } from "@/lib/watch";
import { entityPhrase } from "@/lib/voice";

/**
 * POST /api/watch — has any of these wallets sent USDT since a given moment?
 *
 * Stateless on purpose. There is no database (AGENTS.md §3) and the deployment
 * sleeps when idle, so nothing server-side could hold a watchlist or run on a
 * schedule. The desk holds the list and asks; this answers one narrow question
 * per wallet with one request each, through the same chain client — and the
 * same pacing — every trace uses, so a check can never out-throttle a trace.
 *
 * Body: { items: [{ address, since }] } — `since` is an ISO timestamp.
 */
export const dynamic = "force-dynamic";

/** A desk full of CRITICAL cases, not a scanner. Keeps one request bounded. */
const MAX_ITEMS = 25;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const raw =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? ((body as { items: unknown[] }).items)
      : null;
  if (!raw) {
    return NextResponse.json({ error: "Expected { items: [{ address, since }] }." }, { status: 400 });
  }
  if (raw.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `At most ${MAX_ITEMS} wallets per check.` },
      { status: 400 },
    );
  }

  // One client per chain, each with its own pacing; a desk may watch both.
  const tron = new TronGrid();
  const eth = new EthClient();
  const results: WatchResult[] = [];

  for (const item of raw) {
    const address =
      item && typeof item === "object" && typeof (item as { address?: unknown }).address === "string"
        ? (item as { address: string }).address.trim()
        : "";
    const sinceMs = Date.parse(
      item && typeof item === "object" ? String((item as { since?: unknown }).since ?? "") : "",
    );

    const check = checkAddress(address);
    if (!check.valid || !Number.isFinite(sinceMs)) {
      results.push({
        address,
        status: "unchecked",
        reason: "Not a valid address and timestamp.",
      });
      continue;
    }

    const client = check.chain === "ethereum" ? eth : tron;
    const read = await client.outflowsSince(check.address, sinceMs);
    if (!read) {
      results.push({
        address,
        status: "unchecked",
        reason: "The chain did not answer for this wallet. Nothing is stated about it.",
      });
      continue;
    }

    if (read.transfers.length === 0) {
      results.push({ address, status: "still" });
      continue;
    }

    results.push({
      address,
      status: "moved",
      complete: read.complete,
      movements: read.transfers
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((t) => {
          const label = lookup(t.to);
          return {
            txHash: t.txHash,
            to: t.to,
            valueUsdt: t.value,
            timestamp: new Date(t.timestamp).toISOString(),
            // Named by the one wording rule, or not named at all.
            toPhrase: label ? entityPhrase(label) : null,
          };
        }),
    });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    apiCalls: tron.apiCalls + eth.apiCalls,
    results,
  });
}
