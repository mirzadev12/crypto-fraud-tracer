import ChainReading from "./ChainReading";
import { Designation, Skeleton } from "./ui";

/**
 * What a case page shows the instant it is asked for, before its own code has
 * loaded: the trace-reading drawing and the case file's outline, so the page
 * arrives into the same shape instead of jumping from blank to finished.
 * Rendered by each case route's `loading.tsx`; no state, no data.
 */
export default function CaseLoading({ what = "Opening the case" }: { what?: string }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Designation>[ {what.toLowerCase()} ]</Designation>
          <span className="flex items-center gap-2 font-mono text-xs text-faint">
            <span className="fx-mark h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
            on-chain
          </span>
        </div>
        <div className="mt-6 max-w-3xl">
          <ChainReading hop={1} label={what} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}
