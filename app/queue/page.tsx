import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import BulkTriage from "@/components/BulkTriage";
import { PageHeader, buttonStyles } from "@/components/ui";
import { frozenAddresses } from "@/lib/demo";

/*
 * The addresses captured from the live pipeline (AGENTS.md §10). Taken from
 * `frozenAddresses()` rather than the JSON directly, so the sample is exactly
 * the set demo mode can answer — a malformed entry that `lib/demo.ts` drops is
 * dropped here too, and the button can never offer an address the frozen file
 * would not serve.
 *
 * Only the addresses cross to the client; the full TraceResults stay on the
 * server. They are real wallets, so a run here is a real run — in demo mode
 * they answer from the file in milliseconds instead.
 */
const CAPTURED: string[] = frozenAddresses();

export const metadata: Metadata = {
  title: "Bulk triage",
  description:
    "Trace a whole morning of complaints in one run and sort them by whether the stolen funds can still be reached.",
};

export default function QueuePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Bulk triage"
        title="A morning of complaints"
        description="Paste every wallet reported overnight. Each is traced on the chain in turn and the list reorders itself as answers land, so the cases with money still sitting somewhere are at the top before the desk opens."
        actions={
          <Link href="/investigate" className={buttonStyles.secondary}>
            Trace one address
          </Link>
        }
      />
      <BulkTriage sample={CAPTURED} />
    </AppShell>
  );
}
