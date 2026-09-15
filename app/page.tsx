import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CaseQueue from "@/components/CaseQueue";
import { PageHeader, buttonStyles } from "@/components/ui";

/**
 * The desk.
 *
 * Work is the first thing an investigator should see, so the queue is the
 * application's home rather than a destination two clicks behind a landing
 * page. The argument for the product — what it is, and why a block explorer is
 * not enough — moved to `/about`, where a first-time reader or a judge still
 * finds it, and both the footer and the About link reach it.
 */
export const metadata: Metadata = {
  title: "Case Queue",
  description:
    "Today's complaints, ordered by whether the stolen funds can still be reached.",
};

export default function HomePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Case register"
        title="Today's queue"
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
      <div className="mt-6">
        <CaseQueue />
      </div>
    </AppShell>
  );
}
