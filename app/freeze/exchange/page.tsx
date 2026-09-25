import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import CombinedFreezeRequest from "@/components/CombinedFreezeRequest";
import { readCombined } from "@/lib/combined";

export const metadata: Metadata = {
  title: "Combined freeze request",
  description:
    "One draft restraint and preservation request to one exchange, for every complaint whose traced funds reached it.",
};

export default async function CombinedFreezePage({ searchParams }: PageProps<"/freeze/exchange">) {
  // Each case is pinned to the run it came from; see lib/combined.ts.
  const { entity, cases } = readCombined(await searchParams);
  return (
    <AppShell>
      <CombinedFreezeRequest entity={entity} cases={cases} />
    </AppShell>
  );
}
