"use client";

/**
 * The register, beside the case you are reading.
 *
 * Pressing Evidence while inside a case used to land on the list of every
 * complaint on the system, losing the one you were working. Opening only that
 * case loses the opposite thing — the ability to move to the next one without
 * going back twice. The rail is the answer to both: the case you came in with
 * is the content, the rest sit beside it, and the one you are on is marked so
 * you can see at a glance where you are in the morning's list.
 *
 * It carries `print:hidden` because the packet beside it is a document an
 * officer files, and a list of unrelated complaints must not print onto it.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCases, isIllustrative } from "@/lib/api";
import { formatUsdt, shortAddress } from "@/lib/format";
import type { CaseSummary } from "@/lib/types";
import { Panel, Skeleton, TriageBadge } from "@/components/ui";

/** Same order as the register: whatever still has money comes first. */
const TRIAGE_ORDER = { HOT: 0, WARM: 1, COLD: 2 } as const;

export default function CaseRail({
  active,
  kind,
}: {
  active: string;
  /** Which screen the rail is beside, so each row stays on that screen. */
  kind: "report" | "freeze";
}) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCases()
      .then(({ data }) => {
        if (cancelled) return;
        setCases([...data].sort((a, b) => TRIAGE_ORDER[a.triage] - TRIAGE_ORDER[b.triage]));
      })
      .catch(() => {
        /* The rail is a convenience; the packet beside it stands alone. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bring the case you are on into view — on a long register it is otherwise
  // marked but scrolled out of sight, which is the same as not marked at all.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [cases]);

  const onRegister = cases.some((c) => c.inputAddress === active);

  return (
    <Panel
      title="Cases"
      subtitle="The case you are reading is marked. Pick another to move on."
      bodyClassName="p-0"
      className="print:hidden xl:sticky xl:top-24 xl:self-start"
    >
      {cases.length && !onRegister ? (
        <p className="border-b border-line-soft p-4 text-xs leading-5 text-faint">
          The case open beside this one was traced directly and is not on the
          register.
        </p>
      ) : null}
      <ul className="fx-scroll max-h-[70vh] divide-y divide-line-soft overflow-y-auto">
        {cases.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-12" />
              </li>
            ))
          : cases.map((c) => {
              const isActive = c.inputAddress === active;
              return (
                <li key={c.caseId} ref={isActive ? activeRef : undefined}>
                  <Link
                    href={`/${kind}/${encodeURIComponent(c.inputAddress)}`}
                    aria-current={isActive ? "page" : undefined}
                    className={`block border-l-2 px-4 py-4 transition ${
                      isActive
                        ? "border-brass bg-brass/[0.08]"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <TriageBadge level={c.triage} />
                      {isActive ? (
                        <span className="font-label text-[10px] uppercase tracking-[0.16em] text-brass">
                          Open
                        </span>
                      ) : isIllustrative(c.inputAddress) ? (
                        <span className="font-label text-[10px] uppercase tracking-[0.16em] text-faint">
                          Illustrative
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-2 font-mono text-xs ${
                        isActive ? "text-brass" : "text-muted"
                      }`}
                    >
                      {shortAddress(c.inputAddress, 8, 6)}
                    </p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-faint">
                      {formatUsdt(c.reportedAmountUsdt, { symbol: false })} USDT
                    </p>
                  </Link>
                </li>
              );
            })}
      </ul>
    </Panel>
  );
}
