"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { shortAddress } from "@/lib/format";
import { isTraceableAddress } from "@/lib/address";

/**
 * Two rows, because an officer asks two different questions of a navigation bar.
 *
 * The first answers *what am I here to do*, and it has three answers rather
 * than six. The old bar listed destinations — Cases, Triage, Trace,
 * Intelligence, Evidence — which is a list of our features, not of their
 * intents, and three of those five render the same `getCases()` data in three
 * framings. Reading it, you could not tell which of the three to press, because
 * the names described the implementation rather than the goal.
 *
 * The second row answers *and where within that*, listing only the current
 * section's destinations. Nothing hides behind a menu and the product stays two
 * clicks wide.
 *
 * **Nothing was removed.** Every route the old bar reached is still reached,
 * and the case-scoping added in `f3648cc` is preserved exactly.
 */
interface NavLeaf {
  name: string;
  href: string;
  /** Tooltip on the destination row — what you get, not what it is called. */
  hint: string;
}

interface NavSection {
  name: string;
  href: string;
  leaves: NavLeaf[];
}

const SECTIONS: NavSection[] = [
  {
    name: "Casework",
    href: "/dashboard",
    leaves: [
      { name: "Queue", href: "/dashboard", hint: "Today's complaints, most reachable first" },
      { name: "Batch triage", href: "/queue", hint: "A morning of complaints at once" },
      { name: "New case", href: "/investigate", hint: "Open a wallet or a transaction" },
      { name: "Intelligence", href: "/fund-flow", hint: "Fund flow for the open case" },
      { name: "Evidence", href: "/reports", hint: "Printable packets" },
    ],
  },
  {
    name: "Method",
    href: "/attribution",
    leaves: [
      { name: "Attribution", href: "/attribution", hint: "Where a name comes from" },
      {
        name: "Operating notes",
        href: "/operations",
        hint: "How this runs, and what it cannot do",
      },
    ],
  },
  { name: "Help", href: "/help", leaves: [] },
];

/** Which section a path belongs to, so the bar can state where you are. */
function sectionFor(pathname: string): NavSection {
  if (pathname.startsWith("/attribution") || pathname.startsWith("/operations")) {
    return SECTIONS[1];
  }
  if (pathname.startsWith("/help")) return SECTIONS[2];
  return SECTIONS[0];
}

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
  return isTraceableAddress(address) ? address : null;
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
  const hrefFor = (leaf: NavLeaf) => {
    if (!caseAddress) return leaf.href;
    const encoded = encodeURIComponent(caseAddress);
    if (leaf.href === "/fund-flow") return `/fund-flow?address=${encoded}`;
    if (leaf.href === "/reports") return `/report/${encoded}`;
    return leaf.href;
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    // Scoped Evidence lives at /report/<address>, so the designation has to
    // light up there as well as on the unscoped list.
    if (href === "/reports") return pathname.startsWith("/reports") || pathname.startsWith("/report/");
    return pathname.startsWith(href);
  };

  const section = sectionFor(pathname);
  /*
   * The landing page belongs to no section — it is the argument for the
   * product, not a place inside it — so nothing in the bar lights up there.
   * The destination row still shows Casework's, because that is where a reader
   * who has finished the argument is going next.
   */
  const sectionActive = (s: NavSection) =>
    pathname !== "/" && s.name === section.name;

  /*
   * The bar is sticky, and so is the case bar under it; both used to stick at
   * the top of the viewport, where this one — drawn above — hid the case bar
   * completely the moment the page scrolled. The height is published as
   * `--nav-h` so anything sticky can sit below the navigation instead of
   * behind it. Measured rather than assumed: the second row only exists in
   * sections with destinations, and the phone menu changes the height again.
   */
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty("--nav-h", `${el.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={navRef} className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      {/* The first stop for a keyboard: past a dozen navigation links to the
          page itself. Off-screen until it has focus. Every page's <main> is
          #content. */}
      <a
        href="#content"
        className="fx-skip font-label text-xs font-semibold uppercase tracking-[0.2em] text-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="shrink-0 font-display text-lg uppercase tracking-[0.32em] text-ink"
        >
          FineX
        </Link>

        <div className="hidden min-w-0 items-center gap-2 lg:flex lg:gap-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.name}
              href={s.href}
              aria-current={sectionActive(s) ? "page" : undefined}
              className={`fx-option-quiet whitespace-nowrap px-4 py-2 font-label text-xs font-medium uppercase tracking-[0.24em] ${
                sectionActive(s) ? "fx-option-on text-brass" : "text-faint hover:text-brass"
              }`}
            >
              {s.name}
            </Link>
          ))}
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

      {/* -------------------------------------------------- destination row
          Only the current section's destinations, so nothing hides behind a
          menu. Help has none, and then the row is not drawn at all rather than
          left as an empty rule. */}
      {section.leaves.length ? (
        <div className="hidden border-t border-line-soft lg:block">
          <div className="fx-scroll mx-auto flex min-w-0 max-w-7xl items-center gap-1 overflow-x-auto px-6">
            {section.leaves.map((leaf) => {
              const active = isActive(leaf.href);
              return (
                <Link
                  key={leaf.name}
                  href={hrefFor(leaf)}
                  aria-current={active ? "page" : undefined}
                  title={leaf.hint}
                  className={`fx-option-quiet whitespace-nowrap px-4 py-2 font-label text-[11px] uppercase tracking-[0.2em] ${
                    active ? "fx-option-on text-ink" : "text-faint hover:text-brass"
                  }`}
                >
                  {leaf.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="border-t border-line px-6 py-6 lg:hidden">
          {caseAddress ? (
            <div className="mb-6">
              <CaseScope address={caseAddress} />
            </div>
          ) : null}
          <div className="flex flex-col gap-6">
            {SECTIONS.map((s) => (
              <div key={s.name}>
                <Link
                  href={s.href}
                  onClick={() => setMenuOpen(false)}
                  className={`fx-option-quiet block px-4 py-4 font-label text-xs font-semibold uppercase tracking-[0.24em] ${
                    sectionActive(s) ? "fx-option-on text-brass" : "text-ink"
                  }`}
                >
                  {s.name}
                </Link>
                {s.leaves.length ? (
                  <div className="mt-1 flex flex-col border-l border-line pl-4">
                    {s.leaves.map((leaf) => (
                      <Link
                        key={leaf.name}
                        href={hrefFor(leaf)}
                        onClick={() => setMenuOpen(false)}
                        className={`fx-option-quiet px-4 py-4 font-label text-[11px] uppercase tracking-[0.2em] ${
                          isActive(leaf.href) ? "fx-option-on text-ink" : "text-faint"
                        }`}
                      >
                        {leaf.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
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
