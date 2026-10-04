"use client";

/**
 * "How to send this request" — the exchange's own law-enforcement channel and
 * what it requires before it will act (lib/le-contacts.ts), set above a freeze
 * request. Console chrome: it guides the officer and never prints, because the
 * letter goes to the exchange, which does not need to be told its own portal.
 */

import { accessFor, setAccess, useDeskAccess } from "@/lib/desk-access";
import { leContact, needText, needsAccess, type LeContact } from "@/lib/le-contacts";
import { formatDate } from "@/lib/format";
import { Designation } from "./ui";

/**
 * Can this desk actually send it? A portal needs an account of the desk's own,
 * and some take weeks to approve one, so the guide states the desk's recorded
 * access and the conditions the exchange's page sets, before the letter.
 */
function Readiness({ exchange, contact }: { exchange: string; contact: Extract<LeContact, { found: true }> }) {
  const access = accessFor(useDeskAccess(), exchange);
  const portal = needsAccess(contact);
  // Access is the line above; the checklist holds the rest.
  const checklist = (contact.needs ?? []).filter((n) => !(portal && (n === "approval_first" || n === "account_first")));
  const status = !portal
    ? { tone: "text-muted", head: "No account needed", body: `Sent by ${contact.channels.map((c) => c.kind).join(" or ")}.` }
    : access?.state === "active"
      ? { tone: "text-confirmed", head: "Ready", body: "This desk's portal access is recorded as active." }
      : access?.state === "applied"
        ? {
            tone: "text-suspicious",
            head: "Waiting",
            body: `Portal access applied for on ${formatDate(access.on)}${contact.leadTime ? `; approval generally takes ${contact.leadTime}` : ""}.`,
          }
        : {
            tone: "text-critical",
            head: "Not ready",
            body: `No portal access is recorded for this desk. Apply now${contact.leadTime ? `: approval generally takes ${contact.leadTime}` : ""}.`,
          };
  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className={`font-label text-xs uppercase tracking-[0.16em] ${status.tone}`}>{status.head}</span>
        <span className="text-muted">{status.body}</span>
      </p>
      {portal ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`This desk's access to ${exchange}`}>
          {(
            [
              ["none", "Not recorded"],
              ["applied", "Applied"],
              ["active", "Active"],
            ] as const
          ).map(([value, text]) => {
            const on = (access?.state ?? "none") === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setAccess(
                    exchange,
                    value === "none"
                      ? null
                      : value === "active"
                        ? { state: "active" }
                        : { state: "applied", on: new Date().toISOString().slice(0, 10) },
                  )
                }
                className={`px-2 py-1 font-label text-[10px] uppercase tracking-[0.16em] ${
                  on ? "fx-option fx-option-on text-brass" : "fx-option-quiet text-faint hover:text-brass"
                }`}
              >
                {text}
              </button>
            );
          })}
          <span className="text-xs text-faint">Kept in this browser.</span>
        </div>
      ) : null}
      {checklist.length ? (
        <>
          <p className="mt-4 font-label text-[10px] uppercase tracking-[0.16em] text-faint">Before you send</p>
          <ul className="mt-2 max-w-3xl space-y-1 text-sm leading-6 text-muted">
            {checklist.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden="true" className="text-brass">&#9670;</span>
                <span>{needText(n, contact)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

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
      <Readiness exchange={exchange} contact={contact} />
      {contact.notes.length ? (
        <details className="mt-4 max-w-3xl">
          <summary className="cursor-pointer text-xs text-faint hover:text-brass">
            What its page says ({contact.notes.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted">
            {contact.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
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
