import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  Chip,
  Designation,
  Diamond,
  Rule,
  SectionHeader,
  TriageBadge,
  buttonStyles,
} from "@/components/ui";
import SectionDialog from "@/components/SectionDialog";
import { DEMO_SAMPLES } from "@/lib/api";
import { shortAddress } from "@/lib/format";

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
      <section className="relative -mx-6 -mt-10 overflow-hidden px-6 pb-24 pt-24">
        <div
          className="fx-grid pointer-events-none absolute inset-0 opacity-70"
          aria-hidden="true"
        />
        <div className="relative max-w-4xl">
          <Designation>Bureau of blockchain intelligence · TRON · USDT TRC-20</Designation>

          <h1 className="mt-10 font-display text-4xl uppercase leading-[1.15] tracking-[0.06em] text-ink md:text-6xl">
            Follow the money.
            <br />
            <span className="text-brass">Find the exit.</span>
          </h1>

          <Rule className="mt-10 max-w-md" />

          <p className="mt-10 max-w-xl text-base leading-8 text-muted">
            Most tools stop at the exchange. FineX carries the trail one step
            further — to the customer deposit cluster the funds actually landed
            in — and states, for every case on the desk, whether the money can
            still be reached.
          </p>

          <div className="mt-16 flex flex-col gap-4 sm:flex-row">
            <Link href="/investigate" className={buttonStyles.primary}>
              Open a case
            </Link>
            <Link href="/dashboard" className={buttonStyles.secondary}>
              Case queue
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ triage */}
      <section className="border-t border-line pt-24 pb-16">
        <SectionHeader index="01" title="Disposition" kicker="Every case, one of three" />
        <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_1.4fr]">
          <p className="max-w-sm text-sm leading-7 text-muted">
            Hundreds of complaints arrive a day and a freeze window is measured
            in hours. A graph of wallets does not tell an investigator where the
            next hour is worth spending. A disposition does.
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
              <span className="text-ink">TRON and USDT only.</span> That is where
              the proceeds move. Another chain is an adapter on the same pipeline,
              not a new product.
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

      {/* ----------------------------------------------------------- samples */}
      <section className="pt-24">
        <SectionHeader index="04" title="Case files" kicker="One of each disposition" />
        <ul className="mt-16 divide-y divide-line border-y border-line">
          {DEMO_SAMPLES.map((s) => (
            <li key={s.address}>
              <Link
                href={`/trace/${s.address}`}
                className="group flex flex-col gap-4 py-6 transition hover:bg-surface md:flex-row md:items-center md:gap-16"
              >
                <span className="w-40 shrink-0">
                  <TriageBadge level={s.triage} />
                </span>
                <span className="flex-1 text-sm leading-6 text-ink">{s.headline}</span>
                <span className="font-mono text-xs text-faint">
                  {shortAddress(s.address, 10, 8)}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-faint transition group-hover:text-brass">
                  Open
                  <Diamond className="bg-brass-dim" size={4} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
          These three run from committed case files, so they work with the
          network down. Live tracing takes over as soon as the trace service is
          connected — no screen in this console changes when it does.
        </p>
      </section>
    </AppShell>
  );
}
