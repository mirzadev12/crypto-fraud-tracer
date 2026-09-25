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
import { HELP, type Lang } from "./content";

export const metadata: Metadata = {
  title: "Help",
  description:
    "What each screen in FineX does, and how to trace a wallet from a complaint to a freeze request. In English and Hindi.",
};

/*
 * The words live in ./content.ts, in English and Hindi, in one structure.
 * `?lang=hi` shows the Hindi, marked `lang="hi"` so a screen reader reads it
 * as Hindi and the Devanagari fallback face is used (app/layout.tsx). The
 * Hindi carries a note that it is machine-drafted and needs review.
 */
export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const lang: Lang = (await searchParams).lang === "hi" ? "hi" : "en";
  const t = HELP[lang];

  return (
    <AppShell>
      <nav aria-label="Language" className="flex justify-end gap-2">
        {(
          [
            ["en", "English", "/help"],
            ["hi", "हिन्दी", "/help?lang=hi"],
          ] as const
        ).map(([code, name, href]) => (
          <Link
            key={code}
            href={href}
            lang={code}
            hrefLang={code}
            aria-current={lang === code ? "page" : undefined}
            className={`${lang === code ? "fx-option-on text-brass" : "fx-option-quiet text-faint"} px-4 py-2 text-sm transition hover:text-brass`}
          >
            {name}
          </Link>
        ))}
      </nav>

      <div lang={lang}>
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
          actions={
            <Link href="/investigate" className={buttonStyles.primary}>
              {t.action}
            </Link>
          }
        />

        {t.reviewNote ? (
          <p className="mt-6 max-w-3xl border-l-2 border-suspicious pl-4 text-sm leading-7 text-muted">
            {t.reviewNote}
          </p>
        ) : null}

        {/* ---------------------------------------------------------- screens */}
        <section className="mt-16">
          <SectionHeader index="01" title={t.headings[0].title} kicker={t.headings[0].kicker} />
          {t.sections.map((section) => (
            <div key={section.name} className="mt-10">
              {/* A menu group's name, in English as the menu has it. */}
              <div lang="en">
                <Designation>{section.name}</Designation>
              </div>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {section.screens.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className="fx-option-quiet grid gap-2 px-2 py-6 transition hover:text-brass lg:grid-cols-[10rem_1fr] lg:gap-10"
                    >
                      <span lang="en" className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-brass">
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
          <SectionHeader index="02" title={t.headings[1].title} kicker={t.headings[1].kicker} />
          <ol className="mt-10 grid gap-10 md:grid-cols-2">
            {t.steps.map((step) => (
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
          <SectionHeader index="03" title={t.headings[2].title} kicker={t.headings[2].kicker} />
          <dl className="mt-10 space-y-10">
            {t.status.map((s) => (
              <div
                key={s.level}
                className="grid gap-4 border-t border-line pt-6 lg:grid-cols-[14rem_1fr] lg:gap-10"
              >
                <dt lang="en">
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
          <SectionHeader index="04" title={t.headings[3].title} kicker={t.headings[3].kicker} />
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {t.buttons.map((b) => (
              <Explain key={b.title} title={b.title} body={b.body} />
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- limits */}
        <section className="mt-24 mb-10">
          <SectionHeader index="05" title={t.headings[4].title} kicker={t.headings[4].kicker} />
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {t.limits.map((l) => (
              <Explain key={l.title} title={l.title} body={l.body} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** A title with no Devanagari in it is an English control name, and is marked so. */
const englishName = (text: string) => (/[\u0900-\u097F]/.test(text) ? undefined : "en");

function Explain({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l border-line pl-6">
      <div lang={englishName(title)}>
        <Designation>{title}</Designation>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
