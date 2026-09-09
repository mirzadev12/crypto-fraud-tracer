import type { ReactNode } from "react";
import Link from "next/link";
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
        className={`fx-rise mx-auto w-full flex-1 px-6 py-10 ${wide ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-7xl px-6 py-16">
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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-faint">
            SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C
          </p>
          <Link
            href="/operations"
            className="font-label text-xs uppercase tracking-[0.2em] text-faint transition hover:text-brass"
          >
            How this runs · operating notes
          </Link>
        </div>
      </div>
    </footer>
  );
}
