import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import FreezeRequest from "@/components/FreezeRequest";
import { readPinned, shortAddress } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Freeze request ${shortAddress(decodeURIComponent(address))}`,
    description: `Draft restraint and preservation request for the exchange account reached from TRON address ${decodeURIComponent(address)}.`,
  };
}

export default async function FreezePage({
  params,
  searchParams,
}: PageProps<"/freeze/[address]">) {
  const { address } = await params;
  // The request must state the same figures as the trace it was opened from.
  const pinned = readPinned(await searchParams);
  return (
    <AppShell>
      <FreezeRequest address={decodeURIComponent(address)} {...pinned} />
    </AppShell>
  );
}
