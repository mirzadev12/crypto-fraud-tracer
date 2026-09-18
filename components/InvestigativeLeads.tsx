"use client";

import AddressChip from "@/components/AddressChip";
import { Designation, EmptyState } from "@/components/ui";
import type { Lead } from "@/lib/leads";

/**
 * The act layer, on screen.
 *
 * Every lead here is numbered, and the number is the same one drawn on the
 * wallet in all three canvas views. That is the point of the numbering: an
 * officer reading "① money is still sitting here" can find ① on the graph
 * without matching a 34-character address by eye, which is the actual
 * experience of using a blockchain tool and the reason so much of it is slow.
 *
 * Clicking a lead selects its wallet everywhere else on the page.
 */
export default function InvestigativeLeads({
  leads,
  selected,
  onSelect,
}: {
  leads: Lead[];
  selected: string | null;
  onSelect: (address: string | null) => void;
}) {
  if (!leads.length) {
    return (
      <EmptyState
        title="No leads computed"
        description="Nothing on this path carries enough of the reported amount to be worth naming as a next step. The wallets table below lists everything the trace reached."
      />
    );
  }

  return (
    <ol className="divide-y divide-line">
      {leads.map((lead) => {
        const active = selected === lead.address;
        return (
          <li key={lead.address}>
            <button
              type="button"
              onClick={() => onSelect(active ? null : lead.address)}
              aria-pressed={active}
              className={`fx-option-quiet block w-full px-2 py-6 text-left transition ${
                active ? "bg-white/5" : ""
              }`}
            >
              <div className="flex gap-4">
                <LeadMark rank={lead.rank} tone={lead.tone} />
                <div className="min-w-0 flex-1">
                  <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                    {lead.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">{lead.finding}</p>
                  <p className="mt-2 text-xs leading-5 text-faint">{lead.action}</p>

                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {lead.evidence.map((item) => (
                      <li
                        key={item}
                        className="font-mono text-xs text-faint before:mr-2 before:text-dim before:content-['·'] first:before:content-none first:before:mr-0"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
            <div className="px-2 pb-6 pl-12">
              <AddressChip address={lead.address} full tone={active ? "brand" : "default"} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The numbered lozenge. Square, because nothing in this interface has a radius,
 * and the number is mono so it reads as an index rather than a score.
 */
export function LeadMark({
  rank,
  tone,
  size = 28,
}: {
  rank: number;
  tone: Lead["tone"];
  size?: number;
}) {
  const border =
    tone === "critical"
      ? "border-critical/60 text-critical"
      : tone === "suspicious"
        ? "border-suspicious/60 text-suspicious"
        : "border-line text-faint";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border font-mono text-xs font-semibold ${border}`}
      style={{ width: size, height: size }}
    >
      {rank}
    </span>
  );
}

/** The one-line version, for the panel header. */
export function LeadsSummary({ leads }: { leads: Lead[] }) {
  if (!leads.length) return null;
  return (
    <Designation>
      {leads.length} lead{leads.length === 1 ? "" : "s"} · numbered on the canvas
    </Designation>
  );
}
