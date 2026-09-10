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
        eyebrow="Case register"
        title="Case queue"
        description="Ordered from most to least suspicious. Critical cases still have money sitting somewhere and are worth the next hour on the desk."
        actions={
          <Link href="/investigate" className={buttonStyles.primary}>
            Open a case
          </Link>
        }
      />
      <div className="mt-6">
        <CaseQueue />
      </div>
    </AppShell>
  );
}
