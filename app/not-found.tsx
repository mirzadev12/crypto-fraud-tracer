import Link from "next/link";
import AppShell from "@/components/AppShell";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="font-mono text-sm text-brand">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          That page is not part of the console
        </h1>
        <p className="mt-3 max-w-md text-sm leading-7 text-muted">
          Check the address, or head back to the case queue and pick up a
          complaint from there.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={buttonStyles.primary}>
            Case queue
          </Link>
          <Link href="/investigate" className={buttonStyles.secondary}>
            New investigation
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
