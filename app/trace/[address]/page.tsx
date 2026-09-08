import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import TraceLoader from "@/components/TraceLoader";
import { shortAddress } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Trace ${shortAddress(decodeURIComponent(address))}`,
    description: `Fund-flow trace and triage for TRON address ${decodeURIComponent(address)}.`,
  };
}

export default async function TracePage({ params }: Params) {
  const { address } = await params;
  return (
    <AppShell wide>
      <TraceLoader address={decodeURIComponent(address)} />
    </AppShell>
  );
}
