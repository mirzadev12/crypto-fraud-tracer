import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import WalletOrigin from "@/components/WalletOrigin";
import { buttonStyles, PageHeader } from "@/components/ui";
import { shortAddress, explorerAddressUrl } from "@/lib/format";

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  const clean = decodeURIComponent(address);
  return {
    title: `Wallet ${shortAddress(clean)}`,
    description: `Origin and counterparties for wallet ${clean} — when it was first seen, who funded it, and where it sent money.`,
  };
}

export default async function WalletPage({
  params,
}: PageProps<"/wallet/[address]">) {
  const { address: raw } = await params;
  const address = decodeURIComponent(raw);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Wallet"
        title="Where this came from"
        description="The trace follows money forward. This looks at one address on its own terms: how long it has existed, who paid into it, and where it sent money on."
        actions={
          <>
            <a
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles.ghost}
            >
              Open in block explorer
            </a>
            <Link href={`/trace/${encodeURIComponent(address)}`} className={buttonStyles.primary}>
              Trace this wallet
            </Link>
          </>
        }
      />
      <WalletOrigin address={address} />
    </AppShell>
  );
}
