import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import TraceLoader from "@/components/TraceLoader";
import { readPinned, shortAddress } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Trace ${shortAddress(decodeURIComponent(address))}`,
    description: `Fund-flow trace and triage for wallet ${decodeURIComponent(address)}.`,
  };
}

export default async function TracePage({
  params,
  searchParams,
}: PageProps<"/trace/[address]">) {
  const { address } = await params;
  // ?amount= and ?since= pin the link to the exact run it was shared from.
  const pinned = readPinned(await searchParams);
  return (
    <AppShell wide>
      <TraceLoader address={decodeURIComponent(address)} {...pinned} />
    </AppShell>
  );
}
