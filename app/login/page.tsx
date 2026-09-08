"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/AppShell";
import { Chip, buttonStyles } from "@/components/ui";

/**
 * Prototype sign-in.
 *
 * There is deliberately no password field: authentication would run through the
 * department's own SSO, and a prototype has no business collecting a real
 * credential. The screen records who is working the case — that is what the
 * evidence packet needs — and nothing is transmitted or stored.
 */
export default function LoginPage() {
  const router = useRouter();
  const [officerId, setOfficerId] = useState("");
  const [unit, setUnit] = useState("");

  const field =
    "w-full  border border-line bg-surface-2 px-4 py-4 text-sm text-ink placeholder:text-faint focus:border-brass/50 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar />

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-16 lg:grid-cols-2">
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
                "Triage every complaint HOT, WARM or COLD",
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
        <section className="w-full">
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

            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
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

            <p className="mt-6 border border-line bg-surface-2/60 px-4 py-4 text-xs leading-6 text-faint">
              This build does not authenticate. There is no password field on
              purpose — sign-in would run through departmental SSO, and nothing you
              type here is transmitted or stored. The details are used only to
              attribute the case file.
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
