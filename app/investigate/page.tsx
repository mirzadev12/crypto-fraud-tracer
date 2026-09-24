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
        description="Paste the wallet address, or the transaction that sent the money — a complainant rarely has an address, but their exchange can produce the transaction. The trace follows USDT forward and stops at the first address it can attribute. An address from another chain is screened against the OFAC sanctions list instead."
      />
      <div className="mt-6">
        <InvestigateForm />
      </div>
    </AppShell>
  );
}
