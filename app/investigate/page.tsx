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
        description="A complainant rarely has an address, but their exchange can produce the transaction — either one opens a case. The trace follows the USDT forward and stops at the first address it can attribute; an address on another chain is screened against the OFAC list instead."
      />
      <div className="mt-10">
        <InvestigateForm />
      </div>
    </AppShell>
  );
}
