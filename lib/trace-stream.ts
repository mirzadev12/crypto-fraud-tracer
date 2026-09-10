/**
 * Streams a trace to the browser as newline-delimited JSON.
 *
 * A live trace reads the chain wallet by wallet and can take the better part of
 * a minute. Returned as one JSON body, the screen has nothing to show for that
 * minute but a spinner — and a fetch timeout shorter than the slowest trace
 * silently turns a working trace into "no data". Streamed, every wallet read,
 * hop and attribution reaches the screen the moment the tracer does it, and the
 * client only gives up if the stream goes quiet, not because a trace is long.
 *
 * Lines:
 *   {"kind":"progress","event":{…},"at":1234}
 *   {"kind":"result","trace":{…},"provenance":"live"}
 *   {"kind":"error","message":"…"}
 *
 * Plain JSON callers are unaffected: a route only streams when the request asks
 * for `application/x-ndjson` (or `?stream=1`).
 */

import type { TraceProgress } from "./progress";
import type { TraceResult } from "./types";

type StreamLine =
  | { kind: "progress"; event: TraceProgress; at: number }
  | { kind: "result"; trace: TraceResult; provenance: "live" | "recorded" }
  | { kind: "error"; message: string };

/** Heartbeat, so a proxy never closes or buffers a quiet but healthy stream. */
const HEARTBEAT_MS = 10_000;

export function wantsStream(request: Request): boolean {
  if ((request.headers.get("accept") ?? "").includes("application/x-ndjson")) {
    return true;
  }
  return new URL(request.url).searchParams.get("stream") === "1";
}

export function streamTrace(
  run: (emit: (event: TraceProgress) => void) => Promise<TraceResult>,
  provenance: "live" | "recorded",
): Response {
  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The reader went away. The trace finishes; nobody is listening.
          open = false;
        }
      };
      const send = (line: StreamLine) => write(`${JSON.stringify(line)}\n`);
      const heartbeat = setInterval(() => write("\n"), HEARTBEAT_MS);

      try {
        const trace = await run((event) =>
          send({ kind: "progress", event, at: Date.now() - started }),
        );
        send({ kind: "result", trace, provenance });
      } catch (err) {
        send({
          kind: "error",
          message:
            err instanceof Error ? err.message : "The trace could not be completed.",
        });
      } finally {
        clearInterval(heartbeat);
        if (open) controller.close();
        open = false;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      // Tells nginx-style proxies (Render included) not to buffer the stream.
      "x-accel-buffering": "no",
      "x-finex-provenance": provenance,
    },
  });
}
