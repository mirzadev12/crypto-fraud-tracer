import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import BulkTriage from "@/components/BulkTriage";
import { PageHeader, buttonStyles } from "@/components/ui";

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
      <BulkTriage />
    </AppShell>
  );
}
