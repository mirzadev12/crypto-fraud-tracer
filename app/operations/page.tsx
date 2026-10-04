import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { DEMO_SAMPLES, sampleHref } from "@/lib/api";
import demoCases from "@/data/demo-cases.json";
import tronDeposits from "@/data/deposit-addresses.json";
import tronSeeds from "@/data/hot-wallets.json";
import ethDeposits from "@/data/eth/deposit-addresses.json";
import ethSeeds from "@/data/eth/hot-wallets.json";
import polygonDeposits from "@/data/polygon/deposit-addresses.json";
import polygonSeeds from "@/data/polygon/hot-wallets.json";
import vaspScan from "@/data/vasp-scan.json";
import { andList, formatDate, shortAddress } from "@/lib/format";
import { fiuListing, fiuRegistered } from "@/lib/fiu";
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

/* Indian exchanges, chain by chain, counted from the committed files. One
   sentence for all three chains said "no Indian VASP is in the seed list" while
   Ethereum's seed list held three of them; the answer differs by chain. */
const exchangesOf = (rows: Array<{ exchange: string }>) => rows.map((r) => r.exchange);
const indianRows = (rows: Array<{ exchange: string }>) =>
  rows.filter((r) => fiuListing(r.exchange) !== null).length;
const ETH_INDIAN_SEEDS = fiuRegistered(exchangesOf(ethSeeds));
const POLYGON_INDIAN_SEEDS = fiuRegistered(exchangesOf(polygonSeeds));

/* The live-trace timing, stated once so the two places that quote it agree:
   the recorded wallets re-read live on 4 Oct 2026, without an API key. */
const LIVE_TIMING =
  "a first trace takes from about ten seconds to about three minutes, depending on how much history the wallets hold (the recorded wallets, re-read live on 4 Oct 2026: median 12 s, slowest 179 s), and less with an API key";

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
        department&rsquo;s own single sign-on: deployed behind its sign-in gateway,
        FineX takes the verified name the gateway passes and records it against
        every trace and saved case in its{" "}
        <Link href="/audit" className="text-brass hover:underline">
          audit log
        </Link>
        . The prototype&rsquo;s sign-in has no password field — a prototype has no
        business holding a credential — so the officer ID typed there is recorded
        as stated, not verified, and every record says which it is.
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
        The only outbound calls are reads of TRON, Ethereum and Polygon endpoints, which are
        blockchain data, not case data — and, when an officer turns alerts on, a
        notification relayed by that officer&rsquo;s own browser push service,
        encrypted so the service cannot read it. Even a read of public data names
        the wallet being investigated, so a deployment can point every chain read
        at nodes it runs itself, and no third party then learns which wallets are
        under investigation. There is no database server: the
        label tables are plain JSON files in the repository, and what a deployment
        keeps for itself — the shared case file, the audit log and the alert
        watch — are plain files in its own directory. On this demonstration host
        that directory is not kept across deploys or restarts, so the audit log,
        the case file and the alert list start empty after one; a deployment
        that must keep them points{" "}
        <span className="font-mono text-xs">FINEX_STATE_DIR</span> at a
        persistent disk.
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
        USDT on TRON, Ethereum and Polygon, each on its own, so where money leaves
        a chain the trail ends at the last wallet it reached — on Ethereum and
        Polygon at the bridge itself, named from the explorer&rsquo;s tag. On TRON a
        swap through SUN.io&rsquo;s routers or USDT pools stops the trace the same
        way (data/tron-contracts.json); any other TRON contract, a bridge
        included, is read as an ordinary wallet. An address on another chain can be screened against the
        sanctions list here, but not traced.{" "}
        <span className="text-ink">Mixers</span> — nobody can follow a mixer
        deterministically, so a case closes where its trail reaches a labelled
        one rather than continuing on speculation. No mixer list ships yet; a
        sanctioned laundering service closes a case through the OFAC list
        instead.
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
        whole product rather than everything except the prose. One
        machine-learning model does run, and it is advisory: an isolation forest
        (unsupervised, so it needs no labelled outcomes) ranks the unlabelled
        wallets on a trail by how unusual their behaviour is, shown under
        &ldquo;Why&rdquo; with the two features that set each apart. It never
        names an exit, never sets a case&apos;s status, and claims no accuracy,
        because without confirmed outcomes there is none to measure.
      </>
    ),
  },
  {
    q: "How is it secured?",
    a: (
      <>
        <span className="text-ink">The browser talks only to this server.</span>{" "}
        A restrictive Content-Security-Policy forbids loading or fetching anything from
        another origin, and the site refuses to be framed; HSTS, nosniff, a
        referrer policy and a permissions policy are sent on every response.{" "}
        <span className="text-ink">Chain reads are rate-limited</span> per client,
        so no one can spend the shared budget, and every chain response is kept as
        a SHA-256 digest in the case it supports.{" "}
        <span className="text-ink">Every action is logged</span> in a
        hash-chained audit log a script outside the app can verify, and every
        evidence packet carries a findings fingerprint and a QR check link, so an
        altered copy is detectable. <span className="text-ink">No credential is
        collected</span>: sign-in records an officer ID, verified only behind a
        departmental gateway. The chain endpoints can point at the agency&apos;s own
        nodes, so no outside service learns which wallets are under investigation.
        Not done yet, and said so: no external security audit or penetration test.
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
          is traced on TRON, on Ethereum mainnet and on Polygon, each on its own.
          On Ethereum and Polygon, money that enters a bridge stops the trace at
          the bridge, named from the explorer&rsquo;s own tag, so the case says
          where it left; following it onto the destination network is not built.
          On TRON we looked for a way to recognise a bridge honestly and could not
          find one — the officially documented TRON bridge addresses carry no USDT
          transfers at all — so a TRON bridge is read as an ordinary wallet. A swap
          on TRON is recognised where it goes through SUN.io&rsquo;s routers or the
          pools that hold USDT, and stops the trace there. An address from any other chain the OFAC list covers is
          recognised and screened. Polygon carries attribution data of its own,
          built from Polygon&apos;s explorer tags; BNB Chain uses the same address
          format and would run on the same engine too, but no keyless data source
          for it exists.
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
          <span className="text-ink">A supervised risk model.</span> The advisory
          isolation forest is built; a model trained on outcomes is not, because
          there are none to train on yet. Its place is ordering the queue, trained
          on cases I4C has confirmed — it would never name an exchange or set a
          disposition. Rules decide every finding.
        </li>
        <li>
          <span className="text-ink">Indexing at scale.</span> Every trace reads
          the chain on demand through a public API, where {LIVE_TIMING}. At scale, a
          TRON, Ethereum or Polygon node the department runs itself indexes token
          transfers locally: no rate limit, and no outside service sees which
          wallets are under investigation.
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
          <span className="text-ink">No Indian VASP is tagged on TRON.</span> The
          top {vaspScan.holdersScanned.toLocaleString("en-US")} USDT holders there
          were scanned and not one Indian exchange is publicly tagged among them,
          which is the gap a sovereign tool exists to close rather than one we can
          close with a copied address. On Ethereum the seed list includes{" "}
          {andList(ETH_INDIAN_SEEDS)}, and on Polygon {andList(POLYGON_INDIAN_SEEDS)}.
          Deposit addresses derived at Indian exchanges:{" "}
          {indianRows(tronDeposits)} on TRON, {indianRows(ethDeposits)} on
          Ethereum, {indianRows(polygonDeposits)} on Polygon.
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
    note: "Each runs on this deployment. The recorded cases below show them on screen; the API is described on /developers.",
    items: [
      ["Blockchain transaction graph analysis", "Breadth-first tracing with taint carried hop by hop, drawn three ways."],
      ["Automated exchange and VASP identification", `Attribution is a deterministic lookup: ${tronDeposits.length} customer deposit addresses derived on TRON across ${new Set(tronDeposits.map((r) => r.exchange)).size} exchanges from ${tronSeeds.length} tagged seeds, ${ethDeposits.length} on Ethereum across ${new Set(ethDeposits.map((r) => r.exchange)).size} exchanges from ${ethSeeds.length} — ${andList(fiuRegistered(ethDeposits.map((r) => r.exchange)))} among them — and ${polygonDeposits.length} on Polygon across ${new Set(polygonDeposits.map((r) => r.exchange)).size} exchanges from ${polygonSeeds.length}, each label carrying its confidence and evidence tier.`],
      ["Detection of intermediary laundering wallets", "Six behavioural rules, each stating its reason in a sentence an officer can read out."],
      ["Risk categorisation of wallets", "Every wallet that matters is classed as an exit, a chokepoint, at rest, a sanctions stop or an unresolved tail."],
      ["Automated alert generation", "A wallet found holding funds is watched: the desk re-asks the chain whether it has moved, and with alerts on the server asks every five minutes and notifies the officer's browser even when FineX is closed."],
      ["Fund-flow visualisation and dashboards", "Flow, cluster and timeline views, a case queue ordered by what can still be recovered."],
      ["Standardised investigation reports", "An evidence packet carrying the SHA-256 of every chain response, and a restraint request drafted from it."],
      ["API integrations", "Every route is described in an OpenAPI 3.1 specification (/openapi.json) and on /developers, with a curl example for each read route; a permalink replays a past run exactly."],
      ["Near-real-time tracing", `A live trace streams each wallet as it is read. On the public endpoint ${LIVE_TIMING}. A recorded case opens from its file in milliseconds — a file read, not a trace — and a case this server has already read replays at once from the queue.`],
      ["Automated investigative recommendations", "Ranked leads naming the next wallet to open, ordered by what can still be done."],
      ["Multiple blockchain ecosystems", "USDT is traced on TRON, on Ethereum mainnet and on Polygon — one engine, a chain adapter underneath; a 0x address is read on Polygon only when Polygon is chosen. An address from any other chain the OFAC list covers is recognised by its format, checksum verified where the format has one, and screened against that list, not traced."],
      ["AI/ML-assisted risk detection", "An unsupervised isolation forest ranks the unlabelled wallets on a trail by how unusual their behaviour is, with the features that set each apart. Advisory: it never names an exit or sets a status, and no accuracy is claimed."],
    ],
  },
  {
    group: "Decided against, and why",
    note: "These are choices, not gaps. Each one buys something a judge can check.",
    items: [
      ["A mixer and community abuse list", "Left empty rather than filled from an uncitable source, since a wrong entry here closes a case that should stay open."],
    ],
  },
  {
    group: "Not built, with a plan",
    items: [
      ["Identification of cross-chain fund movement", "Partly in place, so listed here rather than as built. On Ethereum and Polygon, money that enters a recognised bridge stops the trace there, named from the explorer's own tag, and the case says the trail left the chain. On TRON a swap through SUN.io's routers or USDT pools stops the trace; a TRON bridge is not recognised, and no recorded case ends at a bridge. Next on TRON: recognising any contract from the chain's own account record, so every swap or bridge stops the trace there."],
      ["Cross-chain tracing", "Each chain is traced on its own. Where money crosses a recognised bridge on Ethereum or Polygon the trail ends at the bridge; following it onto the destination network, and BNB Chain, which shares Ethereum's address format but has no keyless data source, are next."],
      ["NCRP and SAHYOG integration", "Both need access only I4C can grant. Intake already accepts what a complaint contains — a wallet or a transaction hash, singly or in batches."],
      ["Scalable blockchain indexing", "Every trace reads a public endpoint on demand. Each kind of read can already be pointed at the agency's own TRON, Ethereum or Polygon node; indexing transfers locally at scale, with no outside service seeing which wallets are under investigation, is next."],
      ["Automated pattern recognition for fraud typologies", "The scam type on a case is entered by the officer and printed on the packet; FineX does not detect it from the trail. Recognising a typology needs cases labelled by type, which only confirmed complaints can supply. The route is to learn it from those, as a suggestion the officer confirms, never a finding."],
      ["Privacy-enhancing mechanisms", "A Monero address is screened against the OFAC list by exact match only, never traced. The route is at the edges: labelling the services that swap USDT into a privacy coin, so a trace stops there and says so, as it does at a bridge on Ethereum and Polygon."],
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
/* The verb follows the count too: "one were decided against" is what a typed
   "were" printed when the list had one such row. */
const isAre = (n: number) => (n === 1 ? "is" : "are");
const wasWere = (n: number) => (n === 1 ? "was" : "were");

/**
 * Read from the frozen file — case IDs included — so this can never disagree
 * with the register. A finding about money at rest is dated: it was true when
 * the case was recorded, and a wallet can move after that (one has).
 */
const REAL_CASES = (demoCases.cases as Array<{
  address: string;
  triage: string;
  trace: {
    caseId: string;
    chain?: string;
    edges: unknown[];
    nodes: Array<{ depth: number; label: { kind: string; entity: string } | null }>;
    terminal: { label: { entity: string } } | null;
    provenance: { generatedAt: string };
  };
}>).map((c) => {
  const contract = c.trace.nodes.find((n) => n.depth > 0 && n.label?.kind === "contract");
  const recorded = formatDate(c.trace.provenance.generatedAt);
  return {
    caseId: c.trace.caseId,
    address: c.address,
    chain: c.trace.chain,
    finding: c.trace.terminal
      ? `ends at ${c.trace.terminal.label.entity}`
      : contract?.label
        ? `trail enters ${contract.label.entity}`
        : c.triage === "HOT" && c.trace.edges.length === 0
          ? `funds at rest when recorded on ${recorded}`
          : `no exit reached when recorded on ${recorded}`,
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
          {word(COVERAGE_TOTAL)} capabilities. {capital(word(COVERAGE_COUNTS[0]))}{" "}
          {isAre(COVERAGE_COUNTS[0])} built and can be opened right now,{" "}
          {word(COVERAGE_COUNTS[1])} {wasWere(COVERAGE_COUNTS[1])} decided against
          for stated reasons, and {word(COVERAGE_COUNTS[2])}{" "}
          {isAre(COVERAGE_COUNTS[2])} not built — each with the route to building
          it. Nothing here is aspirational: where a line says built, it runs on
          this deployment.
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
        {/* Anyone reading a figure off this tool is entitled to know whether it
            came off the chain or was written to illustrate a shape. The
            register holds only the first kind now; the hand-built traces that
            remain are said to be what they are wherever they open. */}
        <div className="mt-10 border border-line bg-surface-2/40 p-6">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
            Which cases are real
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            {REAL_CASES.length} recorded cases were{" "}
            <strong className="font-semibold text-ink">captured from the chain</strong> by this
            pipeline, each carrying the SHA-256 of every response it was built
            from. Their wallets were chosen by a script from public data, not
            reported by victims. Three hand-built illustrative traces remain in
            the repository, outside the register. Every trace opened anywhere
            says where it came from — the badge reads LIVE TRACE, RECORDED TRACE
            or ILLUSTRATIVE CASE — and the three below are all real.
          </p>
          <ul className="mt-4 space-y-2">
            {REAL_CASES.map((c) => (
              <li key={c.caseId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-xs text-brass">{c.caseId}</span>
                <span className="font-mono text-xs text-faint">
                  {c.address}
                  {c.chain === "polygon" ? " · Polygon" : ""}
                </span>
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
