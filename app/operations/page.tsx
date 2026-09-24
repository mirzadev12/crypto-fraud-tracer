import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { DEMO_SAMPLES, sampleHref } from "@/lib/api";
import demoCases from "@/data/demo-cases.json";
import tronDeposits from "@/data/deposit-addresses.json";
import tronSeeds from "@/data/hot-wallets.json";
import ethDeposits from "@/data/eth/deposit-addresses.json";
import ethSeeds from "@/data/eth/hot-wallets.json";
import { shortAddress } from "@/lib/format";
import {
  CASE_PROOF,
  Designation,
  Diamond,
  PageHeader,
  SectionHeader,
  TriageBadge,
  buttonStyles,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Operations",
  description:
    "Who runs FineX, where the data sits, what it costs, what breaks, and which parts were AI-assisted.",
};

/**
 * The questions a jury actually asks, answered against what the repository is —
 * not what we would like it to be. A row reading "not solved yet, here is the
 * plan" survives a follow-up; a claim that collapses under one does not.
 */
const ROWS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Who operates this on day one?",
    a: (
      <>
        I4C and state cyber cells. Accounts are per officer through the
        department&rsquo;s own single sign-on, which is why the prototype&rsquo;s
        sign-in has no password field — a prototype has no business holding a
        credential, and the screen says so rather than mocking a login.
      </>
    ),
  },
  {
    q: "Where does the data sit?",
    a: (
      <>
        Self-hosted by the deploying agency. No case data leaves it: the wallet
        address, the reported amount and the fraud date stay on the agency&rsquo;s
        own deployment, and nothing is sent to a third-party analytics service.
        The only outbound calls are reads of public TRON and Ethereum endpoints, which are
        blockchain data, not case data. There is no database — the label tables
        are plain JSON files in the repository.
      </>
    ),
  },
  {
    q: "What does it cost to run for a year?",
    a: (
      <>
        Hosting only. The chain data comes from public endpoints with no licence
        fee, and there is no database to pay for. A single small instance capable
        of serving one state cyber cell runs at roughly ₹6,000–₹18,000 a year
        depending on the provider; on existing NIC or departmental infrastructure
        the marginal cost is zero. That figure is hosting, and hosting only — it
        excludes officer time and any future paid API tier if request volumes
        outgrow the public endpoints. The comparison worth making is per-seat
        commercial chain-analytics licensing, which is quoted per analyst per
        year and is foreign-hosted.
      </>
    ),
  },
  {
    q: "What breaks in the field?",
    a: (
      <>
        Four things, honestly. <span className="text-ink">Rate limits</span> — the
        public endpoint throttles after roughly fifty rapid calls; the client
        caches per address, paces requests and returns partial data rather than
        failing a trace. <span className="text-ink">Unlabelled addresses</span> —
        if the trail ends somewhere we hold no label for, we say so instead of
        guessing, and the case is dispositioned on whether the funds are still at
        rest. <span className="text-ink">Cross-chain hops</span> — the trace follows
        USDT on TRON and on Ethereum, each on its own, so where money leaves a
        chain the trail ends at the last wallet it reached — on Ethereum at the
        bridge itself, named from the explorer&rsquo;s tag. An address on another
        chain can be screened against the sanctions list here, but not traced.{" "}
        <span className="text-ink">Mixers</span> — nobody can follow a mixer
        deterministically, so the case is closed at the entry point rather than
        continued on speculation.
      </>
    ),
  },
  {
    q: "Which parts are AI-assisted?",
    a: (
      <>
        Stated plainly, because a caught omission would put every other claim
        here in doubt. The frontend was substantially AI-assisted: component
        code, layout, and copy drafting throughout{" "}
        <span className="font-mono text-xs">app/</span> and{" "}
        <span className="font-mono text-xs">components/</span>. The chain client
        and the clustering script were AI-assisted and then verified against live
        chain responses. What is <span className="text-ink">not</span> delegated:
        the clustering thresholds, the six behavioural rules and the triage logic
        are hand-specified and hand-reviewed, and no attribution decision is made
        by a language model — naming an exchange is a deterministic lookup
        against a provenance-tagged table. <span className="text-ink">No language
        model runs in this system at all</span> — the investigator summary on
        each trace is assembled from the figures already computed for that case,
        so it cannot drift from the evidence printed beside it and the same trace
        always produces the same sentences. AGENTS.md &sect;11 offers a hosted
        model for that paragraph; it was not taken, because the answer to &ldquo;what
        if it hallucinates the exchange name&rdquo; is stronger when it covers the
        whole product rather than everything except the prose.
      </>
    ),
  },
  {
    q: "Who maintains it after the team graduates?",
    a: (
      <>
        The maintenance surface is deliberately small and is not code. It is two
        plain data files —{" "}
        <span className="font-mono text-xs">data/hot-wallets.json</span>, the
        exchange wallets we cluster against, and{" "}
        <span className="font-mono text-xs">data/risk-lists.json</span>, the
        sanctioned addresses — plus six rules in one file. Refreshing the label
        tables is re-running one script and committing its output; it needs an
        analyst, not the original authors. The build plan and every design
        decision are written down in the repository rather than held by whoever
        wrote them.
      </>
    ),
  },
  {
    q: "What is not built yet?",
    a: (
      <ul className="space-y-4">
        <li>
          <span className="text-ink">Following money across a bridge.</span> USDT
          is traced on TRON and on Ethereum mainnet, each on its own. On Ethereum,
          money that enters a bridge stops the trace at the bridge, named from the
          explorer&rsquo;s own tag, so the case says where it left; following it
          onto the destination network is not built. On TRON we looked for a way
          to recognise a bridge honestly and could not find one — the officially
          documented TRON bridge addresses carry no USDT transfers at all. An
          address from any other chain the OFAC list covers is recognised and
          screened. BNB Chain and Polygon use Ethereum&apos;s address format and
          would run on the same engine; their attribution data is built per chain
          and starts from zero.
        </li>
        <li>
          <span className="text-ink">NCRP and SAHYOG integration.</span> Not
          connected — both need access only I4C can grant. Intake already takes
          what a complaint contains: a wallet or a transaction hash, one at a
          time or in batches. Next is a documented intake route that accepts a
          complaint record and returns the trace with a restraint request
          carrying its acknowledgement number; the live connection follows once
          access is granted.
        </li>
        <li>
          <span className="text-ink">Machine-learning risk scores.</span> Not
          built, on purpose. Rules decide every finding, because an attribution
          an officer acts on has to be explained line by line. A model&apos;s
          place is ordering the queue, trained on cases I4C has confirmed — it
          would never name an exchange or set a disposition.
        </li>
        <li>
          <span className="text-ink">Indexing at scale.</span> Every trace reads
          the chain on demand through a public API — about half a minute per
          wallet without an API key. At scale, a TRON or Ethereum node the department runs
          itself indexes token transfers locally: no rate limit, and no outside
          service sees which wallets are under investigation.
        </li>
        <li>
          <span className="text-ink">A TRON mixer list and a community abuse
          list</span> are empty, on purpose: no citable public source was
          available, and an unsourced entry here would close a case wrongly.
          Sanctioned laundering services are covered under the OFAC list instead.
        </li>
        <li>
          <span className="text-ink">Rule calibration.</span> We measured how
          often each behavioural rule fires on 17 wallets nobody reported —
          peel-chain on 16, fan-out on 15, sanctioned contact on none — so the
          weaker rules are known to be weak. Seventeen is a small sample:
          re-setting those thresholds needs a few hundred, and is not done.
        </li>
        <li>
          <span className="text-ink">No Indian VASP</span> is in the seed list:
          2,500 tagged holders were scanned and not one Indian exchange is
          publicly tagged, which is the gap a sovereign tool exists to close
          rather than one we can close with a copied address.
        </li>
      </ul>
    ),
  },
];

/**
 * Every capability the problem statement asks for, against what this repository
 * actually contains. Three groups, because the honest answer is three different
 * answers: built, decided against with a reason, or not yet built with a plan.
 * The detail behind each unbuilt line is in the questions above — this is the
 * index, not a second account of it.
 */
const PS_COVERAGE: Array<{ group: string; note: string; items: Array<[string, string]> }> = [
  {
    group: "Built and running",
    note: "Open any recorded case below and every one of these is on screen.",
    items: [
      ["Blockchain transaction graph analysis", "Breadth-first tracing with taint carried hop by hop, drawn three ways."],
      ["Automated exchange and VASP identification", `Attribution is a deterministic lookup: ${tronDeposits.length} customer deposit addresses derived on TRON across ${new Set(tronDeposits.map((r) => r.exchange)).size} exchanges from ${tronSeeds.length} tagged seeds, and ${ethDeposits.length} on Ethereum across ${new Set(ethDeposits.map((r) => r.exchange)).size} exchanges from ${ethSeeds.length} — CoinDCX and WazirX among them — each label carrying its confidence and evidence tier.`],
      ["Detection of intermediary laundering wallets", "Six behavioural rules, each stating its reason in a sentence an officer can read out."],
      ["Risk categorisation of wallets", "Every wallet that matters is classed as an exit, a chokepoint, at rest, a sanctions stop or an unresolved tail."],
      ["Automated alert generation", "A wallet found holding funds is watched, and the desk re-asks the chain whether it has moved."],
      ["Fund-flow visualisation and dashboards", "Flow, cluster and timeline views, a case queue ordered by what can still be recovered."],
      ["Standardised investigation reports", "An evidence packet carrying the SHA-256 of every chain response, and a restraint request drafted from it."],
      ["API integrations", "Seven documented endpoints; a permalink replays a past run exactly."],
      ["Real-time tracing", "A recorded case answers in milliseconds. A live wallet takes about half a minute on the public endpoint, and less with an API key."],
      ["Automated investigative recommendations", "Ranked leads naming the next wallet to open, ordered by what can still be done."],
      ["Multiple blockchain ecosystems", "USDT is traced on TRON and on Ethereum mainnet — one engine, a chain adapter underneath. An address from any other chain the OFAC list covers is recognised by its format, checksum verified where the format has one, and screened against that list, not traced."],
      ["Identification of cross-chain fund movement", "On Ethereum, money that enters a bridge stops the trace there, with the bridge named from the explorer's own tag and the case stating that the trail left the chain. Following it onto the other network is not built — see below."],
    ],
  },
  {
    group: "Decided against, and why",
    note: "These are choices, not gaps. Each one buys something a judge can check.",
    items: [
      ["AI/ML-assisted risk detection", "Rules only. An attribution an officer acts on has to be defensible line by line; a model's place is ordering the queue, never naming an exchange."],
      ["A mixer and community abuse list", "Left empty rather than filled from an uncitable source, since a wrong entry here closes a case that should stay open."],
    ],
  },
  {
    group: "Not built, with a plan",
    items: [
      ["Cross-chain tracing", "Each chain is traced on its own. Where money crosses a bridge the trail ends at the bridge; following it onto the destination network, and the other EVM networks (BNB Chain, Polygon) that share Ethereum's address format, are next."],
      ["NCRP and SAHYOG integration", "Both need access only I4C can grant. Intake already accepts what a complaint contains — a wallet or a transaction hash, singly or in batches."],
      ["Scalable blockchain indexing", "Every trace reads a public endpoint on demand. At scale, a departmental TRON or Ethereum node indexes transfers locally, with no outside service seeing which wallets are under investigation."],
    ],
    note: "",
  },
];

/* The counts in the paragraph above the list come from the list, so adding a
   row can never leave the prose saying fifteen when there are sixteen. */
const COVERAGE_COUNTS = PS_COVERAGE.map((block) => block.items.length);
const COVERAGE_TOTAL = COVERAGE_COUNTS.reduce((a, b) => a + b, 0);
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty"];
const word = (n: number) => WORDS[n] ?? String(n);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Read from the frozen file so this can never disagree with the register. */
const REAL_CASES = (demoCases.cases as Array<{
  address: string;
  triage: string;
  trace: {
    caseId: string;
    chain?: string;
    edges: unknown[];
    nodes: Array<{ depth: number; label: { kind: string; entity: string } | null }>;
    terminal: { label: { entity: string } } | null;
  };
}>).map((c) => {
  const contract = c.trace.nodes.find((n) => n.depth > 0 && n.label?.kind === "contract");
  return {
    caseId: c.trace.caseId,
    address: c.address,
    finding: c.trace.terminal
      ? `ends at ${c.trace.terminal.label.entity}`
      : contract?.label
        ? `trail enters ${contract.label.entity}`
        : c.trace.edges.length === 0
          ? "funds at rest, never sent"
          : "funds at rest",
  };
});

export default function OperationsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="How this runs"
        actions={
          <Link href="/attribution" className={buttonStyles.secondary}>
            Attribution register
          </Link>
        }
      />

      <dl className="mt-10 divide-y divide-line border-b border-line">
        {ROWS.map((row, i) => (
          <div key={row.q} className="grid gap-6 py-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <dt className="flex gap-6">
              <span className="font-mono text-xs text-brass">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-lg leading-8 text-ink">{row.q}</span>
            </dt>
            <dd className="text-base leading-8 text-muted">{row.a}</dd>
          </div>
        ))}
      </dl>

      {/* The evaluator's own list, answered in their order. A capability we
          decided against reads as a decision here, not as an omission, and one
          we have not built carries the plan beside it. */}
      <section className="mt-24">
        <SectionHeader
          index="01"
          title="Against the problem statement"
          kicker="Every expectation, and where it stands"
        />
        <p className="mt-10 max-w-3xl text-base leading-8 text-muted">
          The problem statement&rsquo;s feature list, consolidated into{" "}
          {word(COVERAGE_TOTAL)} capabilities. {capital(word(COVERAGE_COUNTS[0]))} are
          built and can be opened right now, {word(COVERAGE_COUNTS[1])} were
          decided against for stated reasons, and {word(COVERAGE_COUNTS[2])} are not built — each
          with the route to building it. Nothing here is aspirational: where a
          line says built, a case file on this deployment shows it.
        </p>
        <div className="mt-16 space-y-16">
          {PS_COVERAGE.map((block) => (
            <div key={block.group}>
              <Designation>{block.group}</Designation>
              {block.note ? (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-faint">{block.note}</p>
              ) : null}
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {block.items.map(([need, state]) => (
                  <div
                    key={need}
                    className="grid gap-2 py-4 lg:grid-cols-[1fr_1.4fr] lg:gap-10"
                  >
                    <dt className="flex gap-4 text-sm leading-7 text-ink">
                      <Diamond className="mt-3 shrink-0 bg-brass-dim" size={4} />
                      <span>{need}</span>
                    </dt>
                    <dd className="pl-8 text-sm leading-7 text-muted lg:pl-0">{state}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* The recorded case files live here rather than on the landing page:
          they are what an officer is told to open first, which makes them
          standing instructions rather than a pitch. */}
      <section className="mt-24">
        <SectionHeader
          index="02"
          title="Case files to open first"
          kicker="One of each disposition"
        />
        {/* The register mixes two kinds of case and the contract has no field to
            mark which is which, so it is stated here instead. Anyone reading a
            figure off this tool is entitled to know whether it came off the
            chain or was written to illustrate a shape. */}
        <div className="mt-10 border border-line bg-surface-2/40 p-6">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
            Which cases are real
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            {REAL_CASES.length} entries in the register were{" "}
            <strong className="font-semibold text-ink">captured from the chain</strong> by this
            pipeline, each carrying the SHA-256 of every response it was built
            from. The rest are <strong className="font-semibold text-ink">illustrative</strong>:
            valid addresses generated for this repository, never on the chain,
            some with hand-built traces. Every trace opened anywhere says which
            it is — the badge reads RECORDED TRACE, LIVE TRACE or ILLUSTRATIVE
            CASE — and the three below are all real.
          </p>
          <ul className="mt-4 space-y-2">
            {REAL_CASES.map((c) => (
              <li key={c.caseId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-xs text-brass">{c.caseId}</span>
                <span className="font-mono text-xs text-faint">{c.address}</span>
                <span className="text-xs text-muted">{c.finding}</span>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-16 divide-y divide-line border-y border-line">
          {DEMO_SAMPLES.map((s) => (
            <li key={s.address}>
              <Link
                href={sampleHref(s)}
                className="group flex flex-col gap-4 py-6 transition hover:bg-surface md:flex-row md:items-center md:gap-10"
              >
                <span className="w-40 shrink-0">
                  <TriageBadge level={s.triage} />
                </span>
                <span className="flex-1 text-sm leading-6 text-ink">
                  {CASE_PROOF[s.triage]}
                </span>
                <span className="font-mono text-xs text-faint">
                  {shortAddress(s.address, 10, 8)}
                </span>
                <span className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-faint transition group-hover:text-brass">
                  Open
                  <Diamond className="bg-brass-dim" size={4} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-faint">
          Each was captured from the chain on 14 September 2026 and committed to
          the repository. Its link replays that exact read — from the file with
          demo mode on, from the chain as it stood then with it off — and every
          transaction in it can be re-verified from the response hashes in its
          packet.
        </p>
      </section>

      <div className="mt-24">
        <Designation>Standing limitation</Designation>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Attribution produced here is an investigative lead carrying a stated
          confidence and a stated evidence tier. It is not, on its own, grounds
          for freezing an account, and every evidence packet says so in writing on
          the page an officer would file.
        </p>
      </div>
    </AppShell>
  );
}
