import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import AttributionRegister, {
  type DerivedRow,
  type SeedRow,
} from "@/components/AttributionRegister";
import CalibrationPanel, { type Calibration } from "@/components/CalibrationPanel";
import { PageHeader, buttonStyles } from "@/components/ui";
import deposits from "@/data/deposit-addresses.json";
import seeds from "@/data/hot-wallets.json";
import multichain from "@/data/sanctions-multichain.json";
import riskLists from "@/data/risk-lists.json";
import calibration from "@/data/clustering-calibration.json";

export const metadata: Metadata = {
  title: "Attribution register",
  description:
    "Every exchange deposit address this tool can name, the tagged wallet it was derived from, and the sweep evidence behind it.",
};

/*
 * Counted here, never typed by hand. The figures on the landing page quote this
 * dataset, and a number in prose that has drifted from the file under it is the
 * fastest way to lose an evaluator.
 */
const rows = deposits as DerivedRow[];
const seedRows = seeds as SeedRow[];
const exchanges = new Set(rows.map((r) => r.exchange)).size;
const sanctioned = riskLists.sanctioned.length;
const sanctionedEntities = new Set(riskLists.sanctioned.map((s) => s.entity)).size;

export default function AttributionPage() {
  return (
    <AppShell wide>
      <PageHeader
        eyebrow="Attribution"
        title="Where a name comes from"
        description={`${rows.length} customer deposit addresses across ${exchanges} exchanges, derived from ${seedRows.length} explorer-tagged wallets, plus ${sanctioned} TRON addresses from the published OFAC sanctions list covering ${sanctionedEntities} entities — and ${multichain.count} more on other chains, which an address from any of them is screened against. Nothing here was bought, and every row states the evidence it rests on.`}
        actions={
          <Link href="/operations" className={buttonStyles.secondary}>
            How this runs
          </Link>
        }
      />
      <AttributionRegister rows={rows} seeds={seedRows} />
      <CalibrationPanel data={calibration as Calibration} />
    </AppShell>
  );
}
