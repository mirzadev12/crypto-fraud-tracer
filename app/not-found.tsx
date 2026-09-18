import Link from "next/link";
import AppShell from "@/components/AppShell";
import { DEMO_SAMPLES, sampleHref } from "@/lib/api";
import { CASE_PROOF, Designation, Diamond, buttonStyles } from "@/components/ui";
import { shortAddress } from "@/lib/format";

export default function NotFound() {
  return (
    <AppShell>
      <div className="max-w-3xl">
        <Designation>404</Designation>
        <h1 className="mt-4 font-display text-3xl uppercase tracking-[0.08em] md:text-4xl">
          No such page
        </h1>
        <p className="mt-6 text-sm leading-7 text-muted">
          Check the address, or pick up one of the recorded traces below — each
          reads with the network off.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/" className={buttonStyles.primary}>
            Overview
          </Link>
          <Link href="/dashboard" className={buttonStyles.secondary}>
            Case queue
          </Link>
        </div>

        <ul className="mt-16 divide-y divide-line border-y border-line">
          {DEMO_SAMPLES.map((s) => (
            <li key={s.address}>
              <Link
                href={sampleHref(s)}
                className="group flex flex-col gap-2 py-6 transition hover:bg-surface md:flex-row md:items-center md:gap-10"
              >
                <span className="flex-1 text-sm leading-6 text-ink">
                  {CASE_PROOF[s.triage]}
                </span>
                <span className="font-mono text-xs text-faint">
                  {shortAddress(s.address, 8, 6)}
                </span>
                <Diamond className="bg-brass-dim" size={4} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
