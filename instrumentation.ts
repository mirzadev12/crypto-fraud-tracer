/**
 * Runs once when the server starts (Next's instrumentation hook).
 *
 * The one thing started here is the alert check (`lib/alert-loop.ts`), so a
 * server that has just been deployed, restarted or woken resumes checking the
 * wallets it holds without waiting for anyone to open a desk. The import sits
 * behind the runtime test, as Next's guide advises, so no other runtime ever
 * bundles the chain clients.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAlertLoop } = await import("./lib/alert-loop");
    startAlertLoop();
  }
}
