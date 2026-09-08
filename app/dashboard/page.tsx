import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CaseQueue from "@/components/CaseQueue";
import { PageHeader, buttonStyles } from "@/components/ui";

export const metadata: Metadata = {
  title: "Case Queue",
  description:
    "Today's complaints, ordered by whether the stolen funds can still be reached.",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Investigation dashboard"
        title="Today's case queue"
        description="Sorted by triage, not by time of arrival — HOT cases still have money sitting somewhere and are worth the next hour of an officer's day."
        actions={
          <Link href="/investigate" className={buttonStyles.primary}>
            New investigation
          </Link>
        }
      />
      <div className="mt-8">
        <CaseQueue />
      </div>
    </AppShell>
  );
}
