/**
 * "How to send this request" — the exchange's own law-enforcement channel and
 * what it requires before it will act (lib/le-contacts.ts), set above a freeze
 * request. Console chrome: it guides the officer and never prints, because the
 * letter goes to the exchange, which does not need to be told its own portal.
 */

import { leContact } from "@/lib/le-contacts";
import { formatDate } from "@/lib/format";
import { Designation } from "./ui";

const KIND = { portal: "Portal", email: "Email", form: "Form" } as const;

export default function SendingGuide({ exchange }: { exchange: string }) {
  const contact = leContact(exchange);
  if (!contact) return null;

  if (!contact.found) {
    return (
      <section className="border-l-2 border-line pl-4 print:hidden" aria-label="How to send this request">
        <Designation>How to send this request</Designation>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
          No law-enforcement channel is recorded for {exchange}. {contact.reason} Checked{" "}
          {formatDate(contact.checked)}. Find its channel on its own site before sending.
        </p>
      </section>
    );
  }

  return (
    <section className="border-l-2 border-brass-dim pl-4 print:hidden" aria-label="How to send this request">
      <Designation>How to send this request to {exchange}</Designation>
      <ul className="mt-4 space-y-2">
        {contact.channels.map((c) => (
          <li key={c.href} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="w-16 shrink-0 font-label text-xs uppercase tracking-[0.16em] text-faint">
              {KIND[c.kind]}
            </span>
            <a
              href={c.href}
              target={c.kind === "email" ? undefined : "_blank"}
              rel="noreferrer"
              className="fx-option-quiet min-w-0 px-1 font-mono text-sm text-ink wrap-anywhere transition hover:text-brass"
            >
              {c.kind === "email" ? c.href.replace(/^mailto:/, "") : c.href.replace(/^https:\/\//, "")}
            </a>
            <span className="text-xs text-faint">{c.label}</span>
          </li>
        ))}
      </ul>
      {contact.notes.length ? (
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-4 text-sm leading-6 text-muted">
          {contact.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs leading-6 text-faint">
        From{" "}
        <a href={contact.source} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-brass">
          {exchange}&rsquo;s own page
        </a>
        , read {formatDate(contact.checked)}. Exchanges change these channels: check the page before
        relying on it.
      </p>
    </section>
  );
}
