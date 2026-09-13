import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { DEMO_SAMPLES } from "@/lib/api";
import demoCases from "@/data/demo-cases.json";
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
        The only outbound calls are reads of public TRON endpoints, which are
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
        rest. <span className="text-ink">Cross-chain hops</span> — a bridge is a
        hard stop today; the trail ends at the bridge and is recorded as such.{" "}
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
        against a provenance-tagged table. A model may draft a case summary; it
        never decides a label, a score or a disposition.
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
      <>
        The trace service itself. The label tables, the chain client and the
        clustering script are in the repository; the API routes that run a live
        trace over them are not deployed, and every screen says so rather than
        showing a recorded trace as though it were live. Cross-chain tracing,
        the community abuse list and a TRON mixer list are unbuilt — the last two
        because no citable public source was available, and an unsourced entry
        would close a case wrongly.
      </>
    ),
  },
];

/** Read from the frozen file so this can never disagree with the register. */
const REAL_CASES = (demoCases.cases as Array<{
  address: string;
  triage: string;
  trace: { caseId: string; terminal: { label: { entity: string } } | null };
}>).map((c) => ({
  caseId: c.trace.caseId,
  address: c.address,
  finding: c.trace.terminal
    ? `ends at ${c.trace.terminal.label.entity}`
    : "funds at rest, never sent",
}));

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

      <dl className="mt-16 divide-y divide-line border-y border-line">
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

      {/* The recorded case files live here rather than on the landing page:
          they are what an officer is told to open first, which makes them
          standing instructions rather than a pitch. */}
      <section className="mt-24">
        <SectionHeader
          index="01"
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
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            {REAL_CASES.length} entries in the register were{" "}
            <strong className="font-semibold text-ink">captured from the chain</strong> by this
            pipeline, each carrying the SHA-256 of every response it was built
            from. The rest are <strong className="font-semibold text-ink">illustrative</strong>:
            valid addresses with hand-built traces, kept because they show a
            fuller trail than short real ones do. Any trace opened here says
            which it is — the badge reads RECORDED TRACE or LIVE TRACE.
          </p>
          <ul className="mt-5 space-y-2">
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
                href={`/trace/${s.address}`}
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
          Each was captured from the chain and committed to the repository, so it
          reads with the network down and can be re-verified from the response
          hashes in its packet.
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
