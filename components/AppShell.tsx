import type { ReactNode } from "react";
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
        className={`mx-auto w-full flex-1 px-6 py-10 ${wide ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          TraceX · Crypto Fraud Tracer — TRON / USDT (TRC-20). Attribution is an
          investigative lead, not sole grounds for freezing an account.
        </p>
        <p className="shrink-0">
          SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX
        </p>
      </div>
    </footer>
  );
}
