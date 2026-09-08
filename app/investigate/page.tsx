import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import InvestigateForm from "@/components/InvestigateForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Investigate",
  description:
    "Trace a victim-reported TRON wallet and identify where the stolen USDT went.",
};

export default function InvestigatePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Case intake"
        title="Open a case"
        description="Enter the wallet exactly as it appears on the complaint. The trace follows USDT forward from the date of the fraud and stops at the first address it can attribute."
      />
      <div className="mt-6">
        <InvestigateForm />
      </div>
    </AppShell>
  );
}
