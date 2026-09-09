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
        eyebrow="Records"
        title="Evidence register"
        description="One packet per complaint, print-ready and filed newest first."
      />
      <div className="mt-6">
        <ReportsList />
      </div>
    </AppShell>
  );
}
