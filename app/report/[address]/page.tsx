import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import CaseRail from "@/components/CaseRail";
import EvidencePacket from "@/components/EvidencePacket";
import { readPinned, shortAddress } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Evidence packet ${shortAddress(decodeURIComponent(address))}`,
    description: `Print-ready evidence packet for TRON address ${decodeURIComponent(address)}.`,
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: PageProps<"/report/[address]">) {
  const { address } = await params;
  // The packet reproduces the same run as the trace it was opened from.
  const pinned = readPinned(await searchParams);
  const clean = decodeURIComponent(address);
  return (
    /*
     * The packet you came in with, and the rest of the register beside it.
     * Pressing Evidence inside a case should not lose the case; opening only
     * that case should not lose the list. min-w-0 on the packet column because
     * it holds wide tables and hashes.
     */
    <AppShell wide>
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <CaseRail active={clean} kind="report" />
        <div className="min-w-0">
          <EvidencePacket address={clean} {...pinned} />
        </div>
      </div>
    </AppShell>
  );
}
