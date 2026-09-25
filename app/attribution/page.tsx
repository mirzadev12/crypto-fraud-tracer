import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import AttributionRegister, {
  Fact,
  type DerivedRow,
  type SeedRow,
} from "@/components/AttributionRegister";
import CalibrationPanel, { type Calibration } from "@/components/CalibrationPanel";
import GasPayerCheck, { type GasPayer } from "@/components/GasPayerCheck";
import { PageHeader, Panel, buttonStyles } from "@/components/ui";
import deposits from "@/data/deposit-addresses.json";
import seeds from "@/data/hot-wallets.json";
import ethDeposits from "@/data/eth/deposit-addresses.json";
import ethSeeds from "@/data/eth/hot-wallets.json";
import ethWallets from "@/data/eth/consolidation-wallets.json";
import multichain from "@/data/sanctions-multichain.json";
import riskLists from "@/data/risk-lists.json";
import calibration from "@/data/clustering-calibration.json";
import ethCalibration from "@/data/eth/clustering-calibration.json";
import { fiuListing } from "@/lib/fiu";

export const metadata: Metadata = {
  title: "Attribution register",
  description:
    "Every exchange deposit address this tool can name, on TRON and Ethereum, the tagged wallet it was derived from, and the evidence behind it.",
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

type EthDerived = {
  address: string;
  exchange: string;
  sweepCount: number;
  confidence: number;
  evidence: string;
  sweptTo: string;
  windowTruncated: boolean;
  seed: string;
  route: "sweep" | "funder" | "both";
};
const ethRows: DerivedRow[] = (ethDeposits as EthDerived[]).map((r) => ({
  address: r.address,
  exchange: r.exchange,
  sweepCount: r.sweepCount,
  confidence: r.confidence,
  evidence: r.evidence,
  hotWallet: r.sweptTo,
  windowTruncated: r.windowTruncated,
  seed: r.seed,
  route: r.route,
}));
const ethSeedRows = ethSeeds as SeedRow[];
const ethExchanges = new Set(ethRows.map((r) => r.exchange));
const indian = ethRows.filter((r) => fiuListing(r.exchange)).length;
const evmSanctioned = (multichain.addresses as Array<{ address: string }>).filter((a) =>
  /^0x[0-9a-fA-F]{40}$/.test(a.address),
).length;

export default function AttributionPage() {
  return (
    <AppShell wide>
      <PageHeader
        eyebrow="Attribution"
        title="Where a name comes from"
        description={`On TRON, ${rows.length} customer deposit addresses across ${exchanges} exchanges, derived from ${seedRows.length} explorer-tagged wallets, plus ${sanctioned} TRON addresses from the published OFAC sanctions list covering ${sanctionedEntities} entities. On Ethereum, ${ethRows.length} across ${ethExchanges.size} exchanges from ${ethSeedRows.length} tagged wallets — ${indian} of them at Indian exchanges — plus ${evmSanctioned} OFAC-listed Ethereum-format addresses. ${multichain.count} addresses on other chains are screened, not traced. Nothing here was bought, and every row states the evidence it rests on.`}
        actions={
          <Link href="/operations" className={buttonStyles.secondary}>
            How this runs
          </Link>
        }
      />
      <AttributionRegister rows={rows} seeds={seedRows} />
      <CalibrationPanel data={calibration as Calibration} />
      {ethRows.length ? (
        <div className="mt-24">
          <AttributionRegister
            rows={ethRows}
            seeds={ethSeedRows}
            chain="Ethereum"
            idPrefix="eth"
            searchHint="0x85B5…  ·  CoinDCX"
            method={<EthereumMethod wallets={ethWallets.length} />}
          />
          <CalibrationPanel
            data={ethCalibration as Calibration}
            title="Ethereum · Does an attribution hold when read again?"
            rule={{
              clause:
                "forward at least 90% of what they receive to the wallets they were found sweeping to — twice or more for an address found by its sweeps, once or more for one the exchange paid gas to",
              label: "≥90% · ≥2 sweeps, or funded + ≥1",
            }}
          >
            {"gasPayer" in ethCalibration ? (
              <GasPayerCheck
                data={(ethCalibration as { gasPayer: GasPayer }).gasPayer}
                confidenceOf={Object.fromEntries(
                  ethRows.map((r) => [r.address.toLowerCase(), r.confidence]),
                )}
              />
            ) : null}
          </CalibrationPanel>
        </div>
      ) : null}
    </AppShell>
  );
}

function EthereumMethod({ wallets }: { wallets: number }) {
  return (
    <Panel title="Ethereum · How a row gets here" framed={false}>
      <div className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6 text-sm leading-7 text-muted">
          <p>
            The TRON rule, unchanged: a sender that swept to an exchange&apos;s tagged
            wallets <strong className="font-semibold text-ink">at least twice</strong>{" "}
            and forwarded{" "}
            <strong className="font-semibold text-ink">90% or more</strong> of what it
            received is that exchange&apos;s customer deposit address. On Ethereum it
            counts all of the exchange&apos;s tagged wallets, because exchanges rotate
            them.
          </p>
          <p>
            Ethereum adds a second, independent route. An exchange pays the gas that
            lets a customer deposit address move its tokens, from a wallet explorers
            tag as its <strong className="font-semibold text-ink">Deposit Funder</strong>.
            An address funded from there that then sent 90% or more of its USDT to one
            wallet is a deposit address at that exchange. It is how WazirX is named:
            its deposit addresses sweep into a wallet no explorer tags, which is
            recorded here as derived{wallets ? ` (${wallets} wallet${wallets === 1 ? "" : "s"})` : ""}, not as fact.
          </p>
          <p>
            CoinSwitch is named a third way. Its customer deposit addresses swept into
            CoinSwitch&apos;s own account at Binance, which the explorer names, so the
            sweep rule finds them there. That was in 2021: no CoinSwitch-tagged wallet
            has moved USDT since, so those rows describe CoinSwitch as it was then. The
            account itself is labelled as what it is — a Binance deposit address held
            by CoinSwitch.
          </p>
          <p>
            Nothing under 1 USDT counts, anywhere. Look-alike addresses send dust and
            spoof zero-value transfers into exchange wallets; left in, one such
            look-alike was the only &ldquo;deposit address&rdquo; the unfiltered rule
            found on one Bybit wallet.
          </p>
        </div>
        <div className="min-w-0 space-y-10">
          <Fact
            label="Two signals"
            body="Where the sweep rule and the exchange's own gas wallet both point at the same address, the row says so. Every CoinDCX address found by the sweep rule was also gas-funded by CoinDCX."
          />
          <Fact
            label="What a seed has to pass"
            body="A public explorer tag, opened at the link beside it — and a look at what flows into it. One Bybit-tagged wallet was left out because it receives from Bybit's own wallets, not from customers."
          />
          <Fact
            label="Where it is wrong"
            body="The same as on TRON: a merchant settling to one exchange looks like a customer deposit address. Confidence says how much sweep evidence was seen, never how likely the attribution is to be right."
          />
        </div>
      </div>
    </Panel>
  );
}
