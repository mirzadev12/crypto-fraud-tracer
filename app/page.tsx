import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Chip, Panel, SectionLabel, TriageBadge, buttonStyles } from "@/components/ui";
import { DEMO_SAMPLES } from "@/lib/api";
import { shortAddress } from "@/lib/format";

const WORKFLOW = [
  {
    step: "01",
    title: "Report",
    body: "An officer pastes the victim-reported TRON wallet from the NCRP complaint, with the amount and the date of the fraud.",
  },
  {
    step: "02",
    title: "Trace",
    body: "We follow USDT hop by hop — depth 3, top five outflows per wallet, dust dropped — and carry the victim's taint along every edge.",
  },
  {
    step: "03",
    title: "Attribute",
    body: "The path stops at the first labelled address and names the exchange, and where possible the customer deposit address inside it.",
  },
  {
    step: "04",
    title: "Triage",
    body: "Each case is called HOT, WARM or COLD by whether the money can still be frozen, with one sentence explaining the call.",
  },
];

export default function Home() {
  return (
    <AppShell>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative -mx-6 -mt-10 overflow-hidden px-6 pb-16 pt-16">
        <div className="tx-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="tx-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/[0.06] px-4 py-1.5 text-[11px] font-medium tracking-wide text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            TRON · USDT (TRC-20) · PUBLIC DATA ONLY
          </div>

          <h2 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            Trace the money.
            <br />
            <span className="text-brand">Name the deposit address.</span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Most tools stop at &ldquo;the funds went to Binance.&rdquo; TraceX goes one
            step further and names the customer deposit address inside the
            exchange — the account that can actually be frozen — then tells the
            investigator which of today&rsquo;s complaints still have recoverable
            money.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/investigate" className={buttonStyles.primary}>
              Start investigation →
            </Link>
            <Link href="/dashboard" className={buttonStyles.secondary}>
              Open today&rsquo;s case queue
            </Link>
          </div>

          <dl className="mt-14 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Attribution
              </dt>
              <dd className="mt-2 text-sm leading-6 text-muted">
                Explorer tags as ground truth, extended by sweep-pattern
                clustering. Every label carries a confidence and a source.
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Explainability
              </dt>
              <dd className="mt-2 text-sm leading-6 text-muted">
                Rules, not a model. Every risk flag comes with the plain-English
                reason it fired, ready to read out in court.
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Chain of custody
              </dt>
              <dd className="mt-2 text-sm leading-6 text-muted">
                Every API response is SHA-256 hashed and carried into the
                evidence packet so a trace can be re-verified later.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- triage */}
      <section className="border-t border-line py-14">
        <SectionLabel>The differentiator</SectionLabel>
        <h3 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
          Everyone traces. Nobody triages.
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          NCRP receives hundreds of complaints a day and a freeze window is
          measured in hours. A graph of wallets does not tell an officer where to
          spend the next hour. A triage call does.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              level: "HOT" as const,
              headline: "Funds still at rest",
              body: "No off-ramp reached. The money is sitting at an address with no outgoing transfers — this is where an officer's next hour is worth the most.",
            },
            {
              level: "WARM" as const,
              headline: "Freeze request viable",
              body: "The path terminates at an exchange customer deposit address. The packet names that address so the exchange can act on it.",
            },
            {
              level: "COLD" as const,
              headline: "Document and close",
              body: "The path enters a mixer or a sanctioned address. Nobody can trace deterministically past that point, and we do not pretend otherwise.",
            },
          ].map((c) => (
            <div
              key={c.level}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <TriageBadge level={c.level} size="lg" />
              <p className="mt-4 text-lg font-semibold tracking-tight text-ink">
                {c.headline}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- workflow */}
      <section className="border-t border-line py-14">
        <SectionLabel>Investigation workflow</SectionLabel>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {WORKFLOW.map((w) => (
            <div key={w.step} className="rounded-2xl border border-line bg-surface p-6">
              <span className="font-mono text-sm text-brand">{w.step}</span>
              <h4 className="mt-4 text-base font-semibold tracking-tight">{w.title}</h4>
              <p className="mt-2 text-sm leading-6 text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- method */}
      <section className="grid gap-5 border-t border-line py-14 lg:grid-cols-2">
        <Panel
          title="How a deposit address is identified"
          subtitle="The one piece of the pipeline that turns a graph into an action."
        >
          <p className="text-sm leading-7 text-muted">
            Exchanges give every customer a unique deposit address and later sweep
            it into a main hot wallet. So an address that receives from many
            unrelated sources and forwards almost all of it to one known exchange
            hot wallet, repeatedly, <span className="text-ink">is</span> a customer
            deposit address at that exchange.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-muted">
            <li className="flex gap-3">
              <span className="font-mono text-brand">≥ 2</span>
              sweeps into the same tagged hot wallet
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-brand">≥ 90%</span>
              of everything received forwarded onward
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-brand">0.5–0.95</span>
              confidence, scaled by how many sweeps were observed
            </li>
          </ul>
          <p className="mt-5 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-xs leading-6 text-faint">
            Derived from public block-explorer data. Commercial vendors sell this
            dataset; the method behind it is not a secret, and neither is ours.
          </p>
        </Panel>

        <Panel
          title="Scope, stated up front"
          subtitle="Confident scoping beats a long feature list."
        >
          <div className="space-y-4 text-sm leading-7 text-muted">
            <p>
              <span className="text-ink">TRON and USDT only.</span> That is where
              Indian cyber-fraud proceeds actually move — near-zero fees, fast
              transfers, easy off-ramps. Another chain is an adapter on the same
              pipeline, not a new product.
            </p>
            <p>
              <span className="text-ink">No machine learning.</span> An asset-freezing
              tool cannot hand a judge a black box. Every score here is a rule we
              can defend line by line.
            </p>
            <p>
              <span className="text-ink">No attribution by language model.</span> A
              summary may be written by one; the exchange name never is. It is a
              deterministic lookup against a provenance-tagged table.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip tone="brand">Public APIs only</Chip>
            <Chip tone="brand">Self-hosted</Chip>
            <Chip tone="brand">Zero licence cost</Chip>
          </div>
        </Panel>
      </section>

      {/* --------------------------------------------------------- samples */}
      <section className="border-t border-line py-14">
        <SectionLabel>Try it now</SectionLabel>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          Three frozen cases, one of each triage level
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          These traces are served from committed fixtures, so they work with the
          network off. Live tracing takes over as soon as the trace API is
          deployed — no screen in this app changes when it does.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DEMO_SAMPLES.map((s) => (
            <Link
              key={s.address}
              href={`/trace/${s.address}`}
              className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-brand/40"
            >
              <TriageBadge level={s.triage} />
              <p className="mt-4 text-base leading-6 text-ink">{s.headline}</p>
              <p className="mt-3 font-mono text-xs text-faint">
                {shortAddress(s.address, 10, 8)}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">
                Open trace →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
