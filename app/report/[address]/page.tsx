import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import EvidencePacket from "@/components/EvidencePacket";
import { shortAddress } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Evidence packet ${shortAddress(decodeURIComponent(address))}`,
    description: `Print-ready evidence packet for TRON address ${decodeURIComponent(address)}.`,
  };
}

export default async function ReportPage({ params }: Params) {
  const { address } = await params;
  return (
    <AppShell>
      <EvidencePacket address={decodeURIComponent(address)} />
    </AppShell>
  );
}
