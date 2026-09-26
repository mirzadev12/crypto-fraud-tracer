"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/AppShell";
import { Chip, buttonStyles } from "@/components/ui";
import { signIn, signOut } from "@/lib/officer";
import { useOfficer } from "@/lib/officer-store";

/**
 * Prototype sign-in.
 *
 * There is deliberately no password field: authentication belongs to the
 * department's own sign-in, and a prototype has no business collecting a real
 * credential. The screen records who is working — the Officer ID and unit are
 * kept in this browser and sent with each request, so the audit log can say who
 * traced or saved what, marked as stated and not verified (`lib/identity.ts`).
 * Behind the department's sign-in gateway the server takes the identity from
 * the gateway instead, and ignores what the browser says.
 */
export default function LoginPage() {
  const router = useRouter();
  const officer = useOfficer();
  const [officerId, setOfficerId] = useState("");
  const [unit, setUnit] = useState("");

  const field =
    "w-full border border-line bg-surface-2 px-4 py-4 text-sm text-ink placeholder:text-faint focus:border-brass/50 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar />

      <main
        id="content"
        tabIndex={-1}
        className="mx-auto grid w-full min-w-0 max-w-6xl flex-1 items-center gap-10 px-6 py-16 focus:outline-none lg:grid-cols-2"
      >
        {/* ------------------------------------------------------- context */}
        <section className="relative hidden lg:block">
          <div className="pointer-events-none absolute -inset-10" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brass">
              Investigator console
            </p>
            <h1 className="mt-4 font-display text-4xl uppercase leading-tight tracking-[0.06em]">
              Sign in to work today&rsquo;s queue.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted">
              FineX orders complaints by whether the stolen funds can still be
              reached, names the exchange deposit address that received them, and
              produces a packet you can attach to a freeze request.
            </p>

            <ul className="mt-6 space-y-4 text-sm text-muted">
              {[
                "Triage every complaint as critical, suspicious or closed",
                "Name the customer deposit address, not just the exchange",
                "Every label carries a confidence score and a source",
                "Every API response hashed for chain of custody",
              ].map((line) => (
                <li key={line} className="flex items-start gap-4">
                  <span className="mt-2 h-1 w-1 shrink-0 rotate-45 bg-brass" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- form */}
        <section className="w-full min-w-0">
          <div className="border border-line bg-surface p-6 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-[0.16em]">
                  Investigator login
                </h2>
                <p className="mt-1 text-xs text-faint">
                  Ministry of Home Affairs · I4C
                </p>
              </div>
              <Chip tone="warm">Prototype</Chip>
            </div>

            {officer ? (
              <div className="mt-6 space-y-6">
                <p className="text-sm leading-6 text-muted">
                  Signed in on this browser as{" "}
                  <span className="font-mono text-ink">{officer.officerId}</span>
                  {officer.unit ? <>, {officer.unit}</> : null}. What you trace and save
                  is recorded under this name, marked as stated and not verified.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard" className={`${buttonStyles.primary} grow`}>
                    Continue to console
                  </Link>
                  <button type="button" onClick={() => signOut()} className={buttonStyles.ghost}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (officerId.trim()) signIn({ officerId, unit });
                router.push("/dashboard");
              }}
            >
              <div>
                <label
                  htmlFor="officerId"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-faint"
                >
                  Officer ID
                </label>
                <input
                  id="officerId"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. I4C-2291"
                  className={field}
                />
              </div>

              <div>
                <label
                  htmlFor="unit"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-faint"
                >
                  Unit / cyber cell
                </label>
                <input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. Cyber Crime Cell, Bengaluru"
                  className={field}
                />
              </div>

              <button type="submit" className={`${buttonStyles.primary} w-full`}>
                Continue to console
              </button>
            </form>
            )}

            <p className="mt-6 border border-line bg-surface-2/60 px-4 py-4 text-xs leading-6 text-faint">
              This build does not authenticate, and there is no password field on
              purpose. Your officer ID and unit are kept in this browser and sent
              with what you do, so the audit log can say who did it — marked as
              stated, not verified. Deployed behind the department&rsquo;s sign-in,
              the name comes from that sign-in instead.
            </p>

            <p className="mt-4 text-center text-xs text-faint">
              Just looking around?{" "}
              <Link href="/dashboard" className="text-brass hover:underline">
                Open the case queue
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
