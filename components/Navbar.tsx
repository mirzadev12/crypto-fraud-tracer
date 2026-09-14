"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { shortAddress } from "@/lib/format";
import { isValidTronAddress } from "@/lib/tron";

/* Bureau designations, not product names. */
const navItems = [
  { name: "Cases", href: "/dashboard" },
  { name: "Triage", href: "/queue" },
  { name: "Trace", href: "/investigate" },
  { name: "Intelligence", href: "/fund-flow" },
  { name: "Evidence", href: "/reports" },
  { name: "Help", href: "/help" },
];

/**
 * The routes that mean "you are inside one case".
 *
 * Triage is deliberately absent: it is the screen for working through the
 * morning's whole list, so scoping it to a single case would defeat it.
 */
const CASE_ROUTES = ["/trace/", "/report/", "/freeze/", "/wallet/"];

/**
 * Which address, if any, the officer currently has open.
 *
 * Read from the path rather than from state, so a shared link lands in the same
 * scope the sender was in and a browser Back leaves it exactly the way it was
 * entered — the going-back that gets you out of a case is the platform's, not
 * something this component has to keep in sync.
 */
function caseAddressFrom(pathname: string): string | null {
  const prefix = CASE_ROUTES.find((r) => pathname.startsWith(r));
  if (!prefix) return null;
  const rest = pathname.slice(prefix.length).split("/")[0];
  if (!rest) return null;
  let address: string;
  try {
    address = decodeURIComponent(rest);
  } catch {
    return null;
  }
  // Only a real address scopes the navigation. A malformed segment must not
  // silently send "Evidence" to a packet route for something that is not one.
  return isValidTronAddress(address) ? address : null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const caseAddress = caseAddressFrom(pathname);

  /*
   * Inside a case, the two case-shaped destinations follow the case.
   *
   * Pressing Intelligence while reading one complaint used to throw the officer
   * back into every complaint on the system, which is the opposite of what the
   * click meant — they wanted the fund flow *for this case*. Cases and Triage
   * stay unscoped on purpose: they are the way back out, and the register is
   * where you go to pick a different one.
   */
  const hrefFor = (item: (typeof navItems)[number]) => {
    if (!caseAddress) return item.href;
    const encoded = encodeURIComponent(caseAddress);
    if (item.href === "/fund-flow") return `/fund-flow?address=${encoded}`;
    if (item.href === "/reports") return `/report/${encoded}`;
    return item.href;
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    // Scoped Evidence lives at /report/<address>, so the designation has to
    // light up there as well as on the unscoped list.
    if (href === "/reports") return pathname.startsWith("/reports") || pathname.startsWith("/report/");
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="shrink-0 font-display text-lg uppercase tracking-[0.32em] text-ink"
        >
          FineX
        </Link>

        <div className="hidden items-center gap-2 lg:flex lg:gap-4">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={hrefFor(item)}
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

        <div className="hidden items-center gap-4 lg:flex">
          {caseAddress ? (
            <span className="hidden xl:inline-flex">
              <CaseScope address={caseAddress} />
            </span>
          ) : null}
          <Link
            href="/login"
            className="inline-block fx-option whitespace-nowrap px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass"
          >
            Sign in
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="fx-option whitespace-nowrap px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-line px-6 py-6 lg:hidden">
          {caseAddress ? (
            <div className="mb-6">
              <CaseScope address={caseAddress} />
            </div>
          ) : null}
          <div className="flex flex-col divide-y divide-line border-y border-line">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={hrefFor(item)}
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

/**
 * Says which case the navigation is following, and offers the way out.
 *
 * Without this the scoping is invisible: an officer presses Evidence, gets one
 * packet instead of the list, and has no way to tell whether that is the whole
 * register or a filtered view of it. Stating the constraint is the difference
 * between a feature and a bug.
 */
function CaseScope({ address }: { address: string }) {
  return (
    <span className="inline-flex items-center gap-2 border border-brass-dim px-2 py-1">
      <span className="h-1 w-1 rotate-45 bg-brass" aria-hidden="true" />
      <span className="font-label text-[10px] uppercase tracking-[0.16em] text-faint">
        Case
      </span>
      <span className="font-mono text-[11px] text-brass">{shortAddress(address)}</span>
      <Link
        href="/dashboard"
        title="Leave this case and show every case again"
        aria-label="Leave this case"
        className="fx-option-quiet px-2 font-label text-[10px] uppercase tracking-[0.16em] text-faint transition hover:text-brass"
      >
        Leave
      </Link>
    </span>
  );
}
