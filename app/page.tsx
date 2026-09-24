import Link from "next/link";
import AppShell from "@/components/AppShell";
import DitherField from "@/components/DitherField";
import HeroTrace from "@/components/HeroTrace";
import {
  Chip,
  Designation,
  Rule,
  SectionHeader,
  TriageBadge,
  buttonStyles,
} from "@/components/ui";
import SectionDialog from "@/components/SectionDialog";
import depositAddresses from "@/data/deposit-addresses.json";
import ethDeposits from "@/data/eth/deposit-addresses.json";
import riskLists from "@/data/risk-lists.json";
import multichain from "@/data/sanctions-multichain.json";

/* Counted from the committed files, never typed: a figure typed into prose
   drifts from the file under it (the sanctions figure did, 202 → 334, when the
   list was refreshed). */
const TRON_DEPOSITS = depositAddresses.length;
const ETH_DEPOSITS = ethDeposits.length;
const DEPOSITS = TRON_DEPOSITS + ETH_DEPOSITS;
const TRON_EXCHANGES = new Set(depositAddresses.map((d) => d.exchange)).size;
const ETH_EXCHANGES = new Set(ethDeposits.map((d) => d.exchange)).size;
const EXCHANGES = new Set([...depositAddresses, ...ethDeposits].map((d) => d.exchange)).size;
/* The OFAC-listed addresses a trace can hit: TRON's, and the Ethereum-format ones. */
const EVM_SANCTIONED = (multichain.addresses as Array<{ address: string }>).filter((a) =>
  /^0x[0-9a-fA-F]{40}$/.test(a.address),
).length;
const SANCTIONED = riskLists.sanctioned.length + EVM_SANCTIONED;
/* Every asset the OFAC copy lists an address under, TRON's included. */
const SCREENED_ASSETS = new Set([
  ...Object.keys(multichain.assets),
  ...riskLists.sanctioned.flatMap((s) => (s.asset ?? "TRX").split(",").map((a) => a.trim())),
]).size;

const METHOD = [
  {
    step: "01",
    title: "Victim wallet",
    body: "The address as it appears on the complaint, with the amount reported and the date the fraud occurred.",
  },
  {
    step: "02",
    title: "Blockchain activity",
    body: "Every USDT transfer out of that address after the fraud date, followed hop by hop to a fixed depth.",
  },
  {
    step: "03",
    title: "Taint analysis",
    body: "Each hop inherits the share of the victim's money that reached it, so the trail carries a value, not just a shape.",
  },
  {
    step: "04",
    title: "Behavioural analysis",
    body: "Six rules read the path for dwell time, fan-out, peel chains, round amounts, address age and sanctioned contact.",
  },
  {
    step: "05",
    title: "Entity attribution",
    body: "Where the trail ends at an exchange, sweep-pattern clustering names the likely customer deposit cluster inside it.",
  },
  {
    step: "06",
    title: "Evidence packet",
    body: "A printed document stating the finding, the basis for it, the transaction trail and its own limitations.",
  },
];

export default function Home() {
  return (
    <AppShell>
      {/* -------------------------------------------------------------- hero */}
      <section className="relative -mx-6 -mt-10 overflow-hidden px-6 pb-16 pt-16">
        <div
          className="fx-grid pointer-events-none absolute inset-0 opacity-70"
          aria-hidden="true"
        />
        {/* The dithered plate: a chain of blocks, ordered-dithered through a
            real 4x4 Bayer matrix, which is a printing technique rather than a
            shader effect. It sits full-bleed behind the hero at low contrast —
            the panel above it carries its own surface, so the type and the
            bubble map both stay clean. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <DitherField gridSize={3} opacity={0.16} />
        </div>
        {/* Split: the claim against the instrument's own output. The strongest
            image this page can carry is what the tool actually draws, so the
            right column is a product panel rather than an ornament. */}
        <div className="relative grid items-center gap-x-16 gap-y-16 xl:grid-cols-[1.08fr_1fr]">
          <div className="min-w-0">
            <h1 className="font-display text-4xl uppercase leading-[1.15] tracking-[0.06em] text-ink md:text-5xl">
              Follow the money.
              <br />
              <span className="text-brass">Find the exit.</span>
            </h1>

            <Rule className="mt-10 max-w-md" />

            <p className="mt-10 max-w-xl text-base leading-8 text-muted">
              Most tools stop at the exchange. FineX carries the trail one step
              further — to the <strong className="font-semibold text-ink">customer deposit cluster</strong> the funds
              actually landed in — and states, for every case on the desk, whether
              the money can <strong className="font-semibold text-ink">still be reached</strong>.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/investigate" className={buttonStyles.primary}>
                Open a case
              </Link>
              <Link href="/dashboard" className={buttonStyles.secondary}>
                Case queue
              </Link>
            </div>
          </div>

          <figure className="min-w-0 border border-line bg-surface">
            <figcaption className="flex items-center justify-between gap-4 border-b border-line px-4 py-4">
              <span className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
                Fund flow
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                TRON · Ethereum · USDT
              </span>
            </figcaption>
            <div className="px-4 py-6">
              <HeroTrace />
            </div>
          </figure>
        </div>
      </section>

      {/* ------------------------------------------------------------ figures */}
      {/* The sentence the whole project is packaging: a number, from public
          data, that a commercial vendor charges for. It belongs above the fold
          of the argument, not buried in a dialog. */}
      <section className="border-t border-line py-16">
        <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [String(DEPOSITS), "Customer deposit addresses derived", "/attribution"],
            [String(EXCHANGES), "Exchanges covered by that derivation", "/attribution"],
            [String(SANCTIONED), "Sanctioned addresses on the chains traced", "/attribution"],
            ["0", "Commercial data licences required", null],
          ].map(([figure, label, href]) => (
            <div key={label} className="min-w-0 border-t border-line pt-4">
              <dt className="font-mono text-5xl font-light tabular-nums text-ink">
                {figure}
              </dt>
              <dd className="mt-2 font-label text-[11px] font-semibold uppercase leading-5 tracking-[0.14em] text-faint">
                {href ? (
                  /* A figure an evaluator cannot check is a claim. These three
                     open the dataset they were counted from. */
                  <Link
                    href={href}
                    className="fx-option-quiet px-2 py-1 transition hover:text-brass"
                  >
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 max-w-2xl text-xs leading-6 text-faint">
          {TRON_DEPOSITS} on TRON across {TRON_EXCHANGES} exchanges and {ETH_DEPOSITS} on
          Ethereum across {ETH_EXCHANGES}, CoinDCX and WazirX among them. Derived from
          public chain data and the published OFAC sanctions list,
          which also screens an address from any of the {SCREENED_ASSETS} assets
          it covers. Explorer-tagged exchange wallets are treated as ground truth; the
          deposit clusters are a <strong className="font-semibold text-muted">heuristic</strong> and are
          labelled as one everywhere they appear.
        </p>
      </section>

      {/* ------------------------------------------------------------ triage */}
      <section className="border-t border-line pt-24 pb-16">
        <SectionHeader index="01" title="Disposition" kicker="Every case, one of three" />
        <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_1.4fr]">
          <p className="max-w-sm text-sm leading-7 text-muted">
            Hundreds of complaints arrive a day and a <strong className="font-semibold text-ink">freeze window is measured in
            hours</strong>. A graph of wallets does not tell an investigator where the
            next hour is worth spending. A <strong className="font-semibold text-ink">disposition</strong> does.
          </p>
          <dl className="space-y-10">
            {[
              {
                level: "HOT" as const,
                headline: "Funds still at rest",
                body: "No exit reached. The money is sitting at an address with no outgoing transfers.",
              },
              {
                level: "WARM" as const,
                headline: "Exit identified",
                body: "The trail terminates at a likely exchange deposit cluster. The packet names it so the exchange can act.",
              },
              {
                level: "COLD" as const,
                headline: "Trail ends",
                body: "The path enters a mixing service. Nothing can be followed deterministically past that point, and we do not pretend otherwise.",
              },
            ].map((c) => (
              <div key={c.level} className="border-t border-line pt-6">
                <dt className="flex flex-wrap items-center gap-4">
                  <TriageBadge level={c.level} />
                  <span className="text-lg text-ink">{c.headline}</span>
                </dt>
                <dd className="mt-2 max-w-xl text-sm leading-7 text-faint">{c.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ method */}
      <section className="pt-16">
        <SectionDialog
          index="02"
          title="Method"
          kicker="Complaint to packet"
          summary="Six stages carry a pasted wallet to a printed packet. Open it if you want the pipeline; skip it if you want the finding."
        >
          <ol className="grid gap-x-16 gap-y-10 sm:grid-cols-2">
            {METHOD.map((m) => (
              <li key={m.step} className="border-t border-line pt-4">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-2xl font-light text-brass">{m.step}</span>
                  <h3 className="text-sm uppercase tracking-[0.16em] text-ink">{m.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-faint">{m.body}</p>
              </li>
            ))}
          </ol>
        </SectionDialog>
      </section>

      {/* ------------------------------------------------------- attribution */}
      <section className="pt-16">
        <SectionDialog
          index="03"
          title="Attribution"
          kicker="How an exit is named"
          summary="Sweep-pattern clustering over public data, stated as a likelihood and never as a fact. Open it for the thresholds and the scope we hold ourselves to."
        >
          <p className="text-sm leading-8 text-muted">
            Exchanges issue every customer a unique deposit address and later
            sweep it into a main hot wallet. An address that receives from many
            unrelated sources and forwards almost all of it to one known exchange
            wallet, repeatedly, is <span className="text-ink">very likely</span> a
            customer deposit address at that exchange.
          </p>

          <dl className="mt-10 divide-y divide-line border-y border-line">
            {[
              ["≥ 2", "sweeps into the same tagged exchange wallet"],
              ["≥ 90%", "of everything received forwarded onward"],
              ["0.50 – 0.95", "confidence, scaled by how many sweeps were observed"],
            ].map(([figure, text]) => (
              <div key={figure} className="flex items-baseline gap-6 py-4">
                <dt className="w-32 shrink-0 font-mono text-sm text-brass">{figure}</dt>
                <dd className="text-sm leading-6 text-faint">{text}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-xs leading-6 text-faint">
            Every attribution carries a confidence and the tier of evidence behind
            it. An explorer tag and a clustering heuristic are not the same claim,
            and the interface never lets them look like one.
          </p>

          <div className="mt-16 space-y-6 border-t border-line pt-10 text-sm leading-7 text-muted">
            <p>
              <span className="text-ink">USDT on TRON and Ethereum.</span> TRON is where
              the proceeds mostly move. Ethereum runs on the same engine through a
              chain adapter — another chain is an adapter, not a new product.
            </p>
            <p>
              <span className="text-ink">Rules, not a model.</span> An
              asset-freezing tool cannot hand a court a black box. Every score here
              is a rule that can be defended line by line.
            </p>
            <p>
              <span className="text-ink">No model decides attribution.</span> A
              summary may be generated; the entity name is a deterministic lookup
              against a provenance-tagged table.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            <Chip>Public data</Chip>
            <Chip>Self-hosted</Chip>
            <Chip>No licence cost</Chip>
          </div>
        </SectionDialog>
      </section>

      {/* ---------------------------------------------------------- colophon */}
      <section className="mt-24 border-t border-line pt-6 pb-6">
        <Designation>Bureau of blockchain intelligence · TRON · Ethereum · USDT</Designation>
      </section>

    </AppShell>
  );
}
