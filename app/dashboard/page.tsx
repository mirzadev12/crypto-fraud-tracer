import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CaseQueue from "@/components/CaseQueue";
import WatchAlerts from "@/components/WatchAlerts";
import CaseFile from "@/components/CaseFile";
import OutcomesDesk from "@/components/OutcomesDesk";
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
          <>
            <Link href="/queue" className={buttonStyles.secondary}>
              Triage a batch
            </Link>
            <Link href="/investigate" className={buttonStyles.primary}>
              Open a case
            </Link>
          </>
        }
      />
      {/* The watch sits above the register: an alert that money moved is the
          most time-critical thing on this desk. */}
      <div className="mt-6">
        <WatchAlerts />
      </div>
      {/* Cases officers saved on this deployment, before the committed register
          that is the same everywhere. */}
      <div className="mt-10">
        <CaseFile />
      </div>
      <div className="mt-10">
        <CaseQueue />
      </div>
      {/* What came of the freeze requests sent from this desk. */}
      <div className="mt-16">
        <OutcomesDesk />
      </div>
    </AppShell>
  );
}
