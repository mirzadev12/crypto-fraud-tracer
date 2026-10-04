import type { ReactNode } from "react";
import Link from "next/link";
import LiveStatus from "./LiveStatus";
import Navbar from "./Navbar";

export default function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar />
      <main
        id="content"
        tabIndex={-1}
        className={`fx-rise mx-auto w-full flex-1 px-6 py-10 focus:outline-none ${wide ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* The chain, read now: the proof that what is on screen is current. */}
        <LiveStatus className="mb-10" />
        {/* For a victim who lands here: the national helpline comes first. */}
        <p className="mb-10 text-sm leading-6 text-muted">
          Report cyber fraud: call{" "}
          <span className="font-mono text-base text-ink">1930</span> or visit{" "}
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brass underline-offset-4 hover:underline"
          >
            cybercrime.gov.in
          </a>
          , the National Cyber Crime Reporting Portal.
        </p>
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.32em] text-ink">
              FineX
            </p>
          </div>
          <p className="max-w-md text-xs leading-6 text-faint">
            Attribution stated here is an investigative lead carrying a stated
            confidence. It is not, on its own, grounds for freezing an account.
          </p>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          {/* Who this is for, and what it is not, at the end of every page: a
              student prototype must never be mistaken for a Government of India
              service, so it carries no State Emblem and no national insignia. */}
          <p className="max-w-3xl text-xs leading-5 text-faint">
            A prototype for the Indian Cyber Crime Coordination Centre (I4C), Ministry of Home
            Affairs · Smart India Hackathon 2026 ·{" "}
            <span className="text-muted">Not an official Government of India website</span>
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link
              href="/help"
              className="fx-option-quiet px-2 py-1 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
            >
              How to use this
            </Link>
            <Link
              href="/operations"
              className="fx-option-quiet px-2 py-1 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
            >
              How this runs · operating notes
            </Link>
            <Link
              href="/developers"
              className="fx-option-quiet px-2 py-1 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
            >
              API for integrators
            </Link>
            <Link
              href="/accessibility"
              className="fx-option-quiet px-2 py-1 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
            >
              Accessibility
            </Link>
            <Link
              href="/policies"
              className="fx-option-quiet px-2 py-1 font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
            >
              Policies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
