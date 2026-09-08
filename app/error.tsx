"use client";

import { useEffect } from "react";
import { buttonStyles } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the failure visible in the console rather than swallowing it.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center text-ink">
      <p className="font-mono text-sm text-critical">Something broke</p>
      <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.08em]">
        This screen could not be rendered
      </h1>
      <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
        {error.message || "An unexpected error occurred."}
        {error.digest ? (
          <span className="mt-2 block font-mono text-xs text-faint">
            digest {error.digest}
          </span>
        ) : null}
      </p>
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
        Try again
      </button>
    </div>
  );
}
