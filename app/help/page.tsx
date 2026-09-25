import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  Designation,
  PageHeader,
  SectionHeader,
  TriageBadge,
  buttonStyles,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Help",
  description:
    "What each screen in FineX does, and how to trace a wallet from a complaint to a freeze request.",
};

/*
 * Written plainly on purpose.
 *
 * Every other screen speaks in the register of a bureau instrument, which is
 * right for a finding an officer signs. Someone opening the tool for the first
 * time needs the opposite: short sentences and ordinary words. If a line here
 * needs reading twice, rewrite it.
 *
 * It documents what exists. When a screen is added, add its row.
 */

/*
 * Mirrors the navigation: same two sections, same names, same order. If the
 * navigation is renamed, rename these — a help page that calls a screen by a
 * name the menu no longer uses sends the reader looking for something that is
 * not there.
 */
const SECTIONS = [
  {
    name: "Casework",
    screens: [
      {
        href: "/dashboard",
        nav: "Queue",
        what: "Today's complaints, most urgent first — and alerts if money moves.",
        use: "Start here. Any wallet still holding funds is watched, and you'll see an alert at the top if the money starts to move.",
      },
      {
        href: "/queue",
        nav: "Batch triage",
        what: "Paste many wallet addresses at once, or load a complaint sheet.",
        use: "Use it for a whole morning of complaints. A sheet (CSV with acknowledgement number, wallet or transaction, amount, date) traces each complaint with its own figures and puts its number on the freeze request. The list sorts itself as answers arrive.",
      },
      {
        href: "/investigate",
        nav: "New case",
        what: "Open one complaint: a wallet address or a transaction.",
        use: "Use it when you have one complaint. When the trace is done, View evidence packet at the bottom opens the report for that wallet.",
      },
      {
        href: "/fund-flow",
        nav: "Intelligence",
        what: "The money drawn as a picture.",
        use: "Three views of the same trace: the path, the weight, and the timing.",
      },
      {
        href: "/reports",
        nav: "Evidence",
        what: "Every case as a printable packet.",
        use: "Open one and print it for the file.",
      },
    ],
  },
  {
    name: "Method",
    screens: [
      {
        href: "/attribution",
        nav: "Attribution",
        what: "Every exchange account we can name, and how we worked it out.",
        use: "Open this when someone asks where your data comes from.",
      },
      {
        href: "/operations",
        nav: "Operating notes",
        what: "How this runs, what it costs, and what it cannot do.",
        use: "Open this before answering questions about the tool itself.",
      },
    ],
  },
];

const STEPS = [
  {
    n: "1",
    title: "Paste the address or transaction",
    body: "A TRON address starts with T and is 34 characters long. An Ethereum address starts with 0x and is 42 characters long. A transaction is 64 characters, with 0x in front on Ethereum. Each is checked before anything else happens, and a transaction shows you the wallet it paid before tracing it. An address from any other chain, such as Bitcoin, is not traced: it is checked against the sanctions list instead.",
  },
  {
    n: "2",
    title: "Leave amount and date empty",
    body: "Both are optional. Left blank, we follow everything that ever left the wallet. Fill them in only if the complaint gives an exact figure or date.",
  },
  {
    n: "3",
    title: "Wait about half a minute",
    body: "You will see each wallet as it is read. That is the real progress of the search, not a loading bar.",
  },
  {
    n: "4",
    title: "Read the top line",
    body: "One sentence tells you whether the money can still be reached. Everything below it is the working.",
  },
];

const STATUS = [
  {
    level: "HOT" as const,
    plain: "The money is still sitting somewhere.",
    then: "Nothing has left the wallet it landed in. This is where your next hour goes.",
  },
  {
    level: "WARM" as const,
    plain: "The money reached an exchange.",
    then: "We name the account inside that exchange. Open Freeze request and send it to them.",
  },
  {
    level: "COLD" as const,
    plain: "The trail ends here.",
    then: "It went into a mixing service or a sanctioned address. Nobody can follow it further. Write it up and close it.",
  },
];

const BUTTONS = [
  {
    title: "Evidence packet",
    body: "The whole case on one printable page. It ends with a fingerprint and a code. Anyone holding a copy can scan the code to check its figures against the chain.",
  },
  {
    title: "Freeze request",
    body: "The letter you send the exchange, naming the account to restrict. It only appears when there is an exchange that can act on it. Sign it before it goes out.",
  },
  {
    title: "Permalink",
    body: "A link that reopens this exact result with the same figures. Safe to forward.",
  },
  {
    title: "The small icon next to any address",
    body: "Opens that wallet on its own: how old it is, who paid into it, and where it sent money.",
  },
];

const LIMITS = [
  {
    title: "It cannot name a person",
    body: "We name the account at the exchange. Only the exchange knows who owns it. That is why the freeze request goes to them.",
  },
  {
    title: "It cannot follow money past a mixer",
    body: "Nobody can. We mark where the trail ends and stop, rather than guess.",
  },
  {
    title: "It covers USDT on TRON and Ethereum only",
    body: "That is where this kind of fraud money mostly moves. On Ethereum it reads the main network only: the same 0x address on BNB Chain or Polygon is not read. When money goes into a swap or a bridge, the trace stops there and says so.",
  },
  {
    title: "It never reports silence as an answer",
    body: "If the chain could not be read, the screen says so. It will not tell you a wallet is empty when we simply could not see it.",
  },
];

export default function HelpPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Help"
        title="How to use this"
        description="FineX follows stolen USDT on TRON and Ethereum and tells you whether the money can still be reached."
        actions={
          <Link href="/investigate" className={buttonStyles.primary}>
            Trace a wallet
          </Link>
        }
      />

      {/* ---------------------------------------------------------- screens */}
      <section className="mt-16">
        <SectionHeader index="01" title="The screens" kicker="What each one is for" />
        {SECTIONS.map((section) => (
          <div key={section.name} className="mt-10">
            <Designation>{section.name}</Designation>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {section.screens.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="fx-option-quiet grid gap-2 px-2 py-6 transition hover:text-brass lg:grid-cols-[10rem_1fr] lg:gap-10"
                  >
                    <span className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-brass">
                      {s.nav}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base leading-7 text-ink">{s.what}</span>
                      <span className="mt-1 block text-sm leading-6 text-faint">{s.use}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------ steps */}
      <section className="mt-24">
        <SectionHeader index="02" title="Tracing one wallet" kicker="Four steps" />
        <ol className="mt-10 grid gap-10 md:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-6 border-t border-line pt-6">
              <span className="font-mono text-sm text-brass">{step.n}</span>
              <div className="min-w-0">
                <p className="font-label text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                  {step.title}
                </p>
                <p className="mt-4 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- statuses */}
      <section className="mt-24">
        <SectionHeader index="03" title="What the answer means" kicker="Every case is one of three" />
        <dl className="mt-10 space-y-10">
          {STATUS.map((s) => (
            <div
              key={s.level}
              className="grid gap-4 border-t border-line pt-6 lg:grid-cols-[14rem_1fr] lg:gap-10"
            >
              <dt>
                <TriageBadge level={s.level} />
              </dt>
              <dd className="min-w-0">
                <p className="text-base leading-7 text-ink">{s.plain}</p>
                <p className="mt-2 text-sm leading-6 text-faint">{s.then}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------------- buttons */}
      <section className="mt-24">
        <SectionHeader index="04" title="The buttons" kicker="What each one gives you" />
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          {BUTTONS.map((b) => (
            <Explain key={b.title} title={b.title} body={b.body} />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- limits */}
      <section className="mt-24 mb-10">
        <SectionHeader index="05" title="What it cannot do" kicker="Say this before anyone asks" />
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          {LIMITS.map((l) => (
            <Explain key={l.title} title={l.title} body={l.body} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Explain({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l border-line pl-6">
      <Designation>{title}</Designation>
      <p className="mt-4 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
