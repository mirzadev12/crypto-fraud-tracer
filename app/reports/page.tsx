import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ReportsList from "@/components/ReportsList";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Print-ready evidence packets for every traced complaint, with attribution basis and chain of custody.",
};

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Investigation records"
        title="Evidence packets"
        description="Each packet states the finding, the basis for the attribution, the laundering indicators and the exact API responses it was built from — then states its own limitations in writing."
      />
      <div className="mt-6">
        <ReportsList />
      </div>
    </AppShell>
  );
}
