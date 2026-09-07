"use client";

import Link from "next/link";
import { useState } from "react";

const navItems = [
  { name: "Overview", href: "/" },
  { name: "Investigate", href: "/investigate" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Fund Flow", href: "/fund-flow" },
  { name: "Reports", href: "/reports" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-white/10 bg-[#080b14]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <h1 className="text-xl font-bold tracking-wide">
            TRACE<span className="text-cyan-400">X</span>
          </h1>

          <p className="text-[9px] uppercase tracking-[0.25em] text-gray-500">
            Blockchain Intelligence
          </p>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop Login */}
        <Link
  href="/login"
  className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 md:block"
>
  Investigator Login
</Link>
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg border border-white/10 px-3 py-2 text-gray-300 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <div className="border-t border-white/10 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                {item.name}
              </Link>
            ))}
<Link
  href="/login"
  onClick={() => setMenuOpen(false)}
  className="mt-2 rounded-lg border border-white/10 px-4 py-3 text-left text-sm text-gray-300"
>
  Investigator Login
</Link>
          </div>
        </div>
      )}
    </nav>
  );
}