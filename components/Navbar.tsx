"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Diamond } from "./ui";

/* Bureau designations, not product names. */
const navItems = [
  { name: "Cases", href: "/dashboard" },
  { name: "Trace", href: "/investigate" },
  { name: "Intelligence", href: "/fund-flow" },
  { name: "Evidence", href: "/reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2">
          <span className="font-display text-lg uppercase tracking-[0.32em] text-ink">
            FineX
          </span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.24em] text-faint sm:inline">
            {"//"} Blockchain Intelligence
          </span>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative font-mono text-xs uppercase tracking-[0.24em] transition ${
                  active ? "text-brass" : "text-faint hover:text-ink"
                }`}
              >
                {item.name}
                {active ? (
                  <span className="absolute -bottom-[26px] left-0 h-px w-full bg-brass" />
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-faint">
            <Diamond className="fx-mark bg-confirmed" size={5} />
            System online
          </span>
          <Link
            href="/login"
            className="border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-faint transition hover:border-brass-dim hover:text-brass"
          >
            Sign in
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-faint md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-line px-6 py-6 md:hidden">
          <div className="flex flex-col divide-y divide-line border-y border-line">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`py-4 font-mono text-xs uppercase tracking-[0.24em] transition ${
                  isActive(item.href) ? "text-brass" : "text-faint"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="py-4 font-mono text-xs uppercase tracking-[0.24em] text-faint"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-faint">
            <Diamond className="bg-confirmed" size={5} />
            System online
          </p>
        </div>
      ) : null}
    </nav>
  );
}
