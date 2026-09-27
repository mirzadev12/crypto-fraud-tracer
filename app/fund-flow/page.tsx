import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import FundFlowExplorer from "@/components/FundFlowExplorer";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Fund Flow",
  description: "Follow stolen USDT wallet by wallet, from the victim to the off-ramp.",
};

type Props = {
  searchParams: Promise<{ address?: string | string[]; chain?: string | string[] }>;
};

export default async function FundFlowPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.address) ? params.address[0] : params.address;
  const chain = (Array.isArray(params.chain) ? params.chain[0] : params.chain) === "polygon" ? "polygon" : undefined;

  return (
    <AppShell wide>
      <PageHeader
        eyebrow="Intelligence"
        title="Fund flow"
        description="Victim-reported wallet on the left, the exit on the right. Amber edges are transfers forwarded in under ten minutes — the signature of an automated forwarding script."
      />
      <div className="mt-6">
        <FundFlowExplorer initialAddress={raw} initialChain={chain} />
      </div>
    </AppShell>
  );
}
