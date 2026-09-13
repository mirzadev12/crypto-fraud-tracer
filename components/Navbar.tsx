"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/* Bureau designations, not product names. */
const navItems = [
  { name: "Cases", href: "/dashboard" },
  { name: "Triage", href: "/queue" },
  { name: "Trace", href: "/investigate" },
  { name: "Intelligence", href: "/fund-flow" },
  { name: "Evidence", href: "/reports" },
  { name: "Help", href: "/help" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="shrink-0 font-display text-lg uppercase tracking-[0.32em] text-ink"
        >
          FineX
        </Link>

        <div className="hidden items-center gap-2 md:flex lg:gap-4">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`fx-option-quiet whitespace-nowrap px-4 py-2 font-label text-xs font-medium uppercase tracking-[0.24em] ${
                  active ? "fx-option-on text-brass" : "text-faint hover:text-brass"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <Link
            href="/login"
            className="inline-block fx-option whitespace-nowrap px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass"
          >
            Sign in
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="fx-option whitespace-nowrap px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass md:hidden"
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
                className={`fx-option-quiet px-4 py-4 font-label text-xs font-medium uppercase tracking-[0.24em] ${
                  isActive(item.href) ? "fx-option-on text-brass" : "text-faint hover:text-brass"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="fx-option-quiet px-4 py-4 font-label text-xs uppercase tracking-[0.24em] text-faint hover:text-brass"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
