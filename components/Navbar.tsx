"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { name: "Overview", href: "/" },
  { name: "Investigate", href: "/investigate" },
  { name: "Case Queue", href: "/dashboard" },
  { name: "Fund Flow", href: "/fund-flow" },
  { name: "Reports", href: "/reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="group shrink-0">
          <h1 className="text-lg font-bold tracking-wide text-ink">
            TRACE<span className="text-brand">X</span>
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
            Blockchain Intelligence
          </p>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-lg px-3.5 py-2 text-sm transition ${
                  active
                    ? "text-ink"
                    : "text-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                {item.name}
                {active ? (
                  <span className="absolute inset-x-3.5 -bottom-[15px] h-px bg-brand" />
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-faint lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            TRON · USDT (TRC-20)
          </span>
          <Link
            href="/login"
            className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted transition hover:border-brand/40 hover:text-brand"
          >
            Investigator Login
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg border border-line px-3 py-2 text-muted md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path
                d="m5 5 10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-line px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-4 py-3 text-sm transition ${
                  isActive(item.href)
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-lg border border-line px-4 py-3 text-sm text-muted"
            >
              Investigator Login
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
