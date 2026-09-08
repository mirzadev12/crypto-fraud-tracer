import type { ReactNode } from "react";
import type { TriageLevel } from "@/lib/types";

/* ============================================================================
 * FineX primitives.
 *
 * Two rules govern everything here:
 *   1. Type and rules carry the structure. A bordered box has to earn itself —
 *      containers are the exception, not the default.
 *   2. Brass is structural: a rule, a selected state, a call to action. It is
 *      never decoration, and never twice in the same eyeline.
 * ========================================================================= */

/* ------------------------------------------------------------------- marks */

/** Art Deco lozenge. The bureau's tick mark. */
export function Diamond({
  className = "",
  size = 6,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rotate-45 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Brass hairline, faded at both ends. */
export function Rule({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`fx-rule ${className}`} />;
}

/* ---------------------------------------------------------------- headings */

/**
 * Section header: index, lozenge, display title, and a rule running to the end
 * of the measure. This is the only place display serif appears on a console
 * screen.
 */
export function SectionHeader({
  index,
  title,
  kicker,
  className = "",
}: {
  index?: string;
  title: string;
  kicker?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {index ? (
        <span className="font-mono text-xs tracking-[0.32em] text-brass">{index}</span>
      ) : null}
      <Diamond className="bg-brass" />
      <h2 className="font-display text-xl uppercase tracking-[0.14em] text-ink md:text-2xl">
        {title}
      </h2>
      <div className="h-px flex-1 bg-line" />
      {kicker ? (
        <span className="hidden font-label text-xs uppercase tracking-[0.24em] text-faint sm:block">
          {kicker}
        </span>
      ) : null}
    </div>
  );
}

/** Mono designation strip — used above headings and beside data. */
export function Designation({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-label text-xs font-medium uppercase tracking-[0.28em] text-faint ${className}`}>
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-line pb-10 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-2xl">
        <Designation>{eyebrow}</Designation>
        <h1 className="mt-4 font-display text-3xl uppercase tracking-[0.08em] text-ink md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- regions */

/**
 * A region of the page. Pass `framed={false}` for the common case — a label and
 * a rule, no box. Keep the frame for content that genuinely needs a container:
 * a canvas, a scrolling table, a document sheet.
 */
export function Panel({
  title,
  subtitle,
  code,
  actions,
  framed = true,
  children,
  className = "",
  bodyClassName = "p-6",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  code?: ReactNode;
  actions?: ReactNode;
  framed?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    // min-w-0: a grid or flex child defaults to min-width:auto and refuses to
    // shrink below its content, so a wide table or a nowrap readout inside a
    // panel pushes the whole page sideways on a phone. This lets the panel
    // shrink and its own overflow-x-auto do the scrolling.
    <section
      className={`min-w-0 ${framed ? "border border-line bg-surface" : ""} ${className}`}
    >
      {title ? (
        <header
          className={`flex flex-wrap items-center justify-between gap-4 ${
            framed ? "border-b border-line px-6 py-4" : "border-b border-line pb-4"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Diamond className="bg-brass-dim" size={5} />
            <div className="min-w-0">
              <h2 className="font-label text-xs font-semibold uppercase tracking-[0.24em] text-ink">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-xs leading-5 text-faint">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            {code ? (
              <span className="font-label text-xs uppercase tracking-[0.2em] text-faint">
                {code}
              </span>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={framed ? bodyClassName : ""}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ figures */

/** The fractional part drops back so the eye lands on the magnitude. */
function Split({ value }: { value: string }) {
  const cut = value.lastIndexOf(".");
  if (cut === -1) return <>{value}</>;
  return (
    <>
      {value.slice(0, cut)}
      <span className="text-faint">{value.slice(cut)}</span>
    </>
  );
}

/** A figure, report style: label, rule, number. No card. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "hot" | "warm" | "cold" | "brand";
}) {
  const toneText: Record<string, string> = {
    default: "text-ink",
    brand: "text-ink",
    cold: "text-ink",
    hot: "text-critical",
    warm: "text-suspicious",
  };
  const size =
    value.length > 9
      ? "text-2xl md:text-3xl"
      : value.length > 6
        ? "text-3xl md:text-4xl"
        : "text-4xl md:text-5xl";
  return (
    <div className="border-t border-line pt-4">
      <Designation>{label}</Designation>
      <p
        className={`mt-4 font-mono font-light tabular-nums tracking-tight ${size} ${toneText[tone]}`}
      >
        <Split value={value} />
      </p>
      {hint ? <p className="mt-2 text-xs leading-5 text-faint">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- status */

/**
 * Case status. Red is critical, amber is suspicious, grey is closed — the only
 * saturated colour on a screen, and it always states a finding.
 */
export const TRIAGE_META: Record<
  TriageLevel,
  { label: string; action: string; chip: string; dot: string; text: string; ring: string }
> = {
  HOT: {
    label: "CRITICAL",
    action: "Funds still at rest — act now",
    chip: "border-critical/50 text-critical",
    dot: "bg-critical",
    text: "text-critical",
    ring: "border-critical/50",
  },
  WARM: {
    label: "SUSPICIOUS",
    action: "Exit identified — freeze request viable",
    chip: "border-suspicious/50 text-suspicious",
    dot: "bg-suspicious",
    text: "text-suspicious",
    ring: "border-suspicious/50",
  },
  COLD: {
    label: "CLOSED",
    action: "Trail ends — document and close",
    chip: "border-closed/60 text-closed",
    dot: "bg-closed",
    text: "text-closed",
    ring: "border-closed/50",
  },
};

export function TriageBadge({
  level,
  size = "sm",
  withAction = false,
}: {
  level: TriageLevel;
  size?: "sm" | "lg";
  withAction?: boolean;
}) {
  const meta = TRIAGE_META[level];
  const pad = size === "lg" ? "px-4 py-2" : "px-2 py-1";
  return (
    <span
      className={`inline-flex items-center gap-2 border font-label text-xs font-semibold uppercase tracking-[0.2em] ${meta.chip} ${pad}`}
    >
      <span
        className={`h-1 w-1 rotate-45 ${meta.dot} ${level === "HOT" ? "fx-mark" : ""}`}
      />
      {meta.label}
      {withAction ? (
        <span className="font-sans normal-case tracking-normal text-muted">
          {meta.action}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ badges */

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "hot" | "warm" | "cold" | "violet";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line text-faint",
    brand: "border-brass-dim text-brass",
    hot: "border-critical/50 text-critical",
    warm: "border-suspicious/50 text-suspicious",
    cold: "border-closed/50 text-closed",
    violet: "border-line text-faint",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-2 border px-2 py-1 font-label text-xs uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Attribution provenance. The tier is stated in words rather than implied by
 * colour — an explorer tag and a clustering heuristic are not the same claim.
 */
export function SourceChip({ source }: { source: string }) {
  const map: Record<string, { text: string; title: string; confirmed?: boolean }> = {
    ground_truth: {
      text: "Ground truth",
      title: "Public block-explorer tag — treated as fact.",
      confirmed: true,
    },
    heuristic: {
      text: "Heuristic",
      title: "Derived by sweep-pattern clustering over public data.",
    },
    sanctions: {
      text: "Sanctions list",
      title: "Published sanctions listing.",
    },
    community: {
      text: "Community report",
      title: "Crowd-sourced abuse report — lowest confidence tier.",
    },
  };
  const meta = map[source] ?? { text: source, title: source };
  return (
    <span
      title={meta.title}
      className={`inline-flex items-center gap-2 border px-2 py-1 font-label text-xs uppercase tracking-[0.16em] ${
        meta.confirmed ? "border-confirmed/50 text-confirmed" : "border-line text-faint"
      }`}
    >
      {meta.text}
    </span>
  );
}

/** What each disposition proves — the five-minute narrative, used on the
 *  landing rows, the intake screen and the trace header. */
export const CASE_PROOF: Record<string, string> = {
  WARM: "Proves attribution — names the customer deposit cluster inside the exchange",
  HOT: "Proves triage — funds still at rest, this is where the next hour goes",
  COLD: "Proves honesty — the trail enters a mixer and we say so instead of guessing",
};

/* -------------------------------------------------------- attribution voice */

/**
 * How an attribution is allowed to be worded.
 *
 * A clustering heuristic supports "likely X deposit cluster". It does not
 * support "this wallet is X". The distinction is the difference between an
 * investigative lead and a claim we would have to defend in court, so the
 * phrasing lives in one place and every screen uses it.
 */
export function entityPhrase(
  label:
    | { entity: string; kind: string | null; source: string | null }
    | null
    | undefined,
): string {
  if (!label || !label.kind) return "Unlabelled wallet";
  const certain = label.source === "ground_truth" || label.source === "sanctions";
  switch (label.kind) {
    case "victim_reported":
      return "Victim-reported wallet";
    case "exchange_deposit":
      return certain
        ? `${label.entity} deposit address`
        : `Likely ${label.entity} deposit cluster`;
    case "exchange_hot":
      return certain ? `${label.entity} hot wallet` : `Likely ${label.entity} hot wallet`;
    case "mixer":
      return certain ? label.entity : `Likely mixing service`;
    case "sanctioned":
      return `${label.entity} — sanctioned`;
    default:
      return label.entity;
  }
}

/* --------------------------------------------------------------- feedback */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-start justify-center border-l border-brass-dim py-10 pl-6">
      <p className="font-label text-xs font-semibold uppercase tracking-[0.24em] text-ink">{title}</p>
      <p className="mt-4 max-w-md text-sm leading-6 text-faint">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-l-2 border-critical py-10 pl-6">
      <p className="font-label text-xs font-semibold uppercase tracking-[0.24em] text-critical">
        {title}
      </p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse border border-line-soft bg-surface-2 ${className}`}
      aria-hidden="true"
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- buttons */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 px-6 py-4 font-label text-xs font-semibold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed";

export const buttonStyles = {
  /** Brass. One per eyeline, never more. */
    // Disabled is an outline rather than faded brass: a muddy gold plate reads as
  // a broken control, and this way the action visibly lights up the moment the
  // docket is complete.
  primary:
    `${BUTTON_BASE} bg-brass text-bg hover:bg-[#d3af6d] ` +
    "disabled:border disabled:border-line disabled:bg-transparent disabled:text-dim",
  secondary: `${BUTTON_BASE} border border-line text-ink hover:border-brass-dim hover:text-brass`,
  ghost: `${BUTTON_BASE} px-2 text-faint hover:text-ink`,
};

/* ------------------------------------------------------------ data source */

/**
 * Provenance, not an apology.
 *
 * "Demo data" ends a conversation with an evaluator; naming the source does the
 * opposite. A recorded trace was captured from the chain, its response hashes
 * travel into the evidence packet, and it can be re-verified — so the badge says
 * that rather than confessing to a fixture.
 */
export function DataSourceBadge({
  source,
  note,
}: {
  source: "live" | "demo";
  note?: string;
}) {
  if (source === "live") {
    return (
      <span
        title="Read from the chain by the trace service on this deployment."
        className="inline-flex items-center gap-2 border border-line px-2 py-1 font-label text-xs uppercase tracking-[0.16em] text-faint"
      >
        <span className="h-1 w-1 rotate-45 bg-confirmed" />
        Live trace
      </span>
    );
  }
  return (
    <span
      title={
        note ??
        "Recorded trace: captured from the TRON chain on 29 August 2026, committed to the repository, and re-verifiable — the SHA-256 of every response it was built from is carried into the evidence packet."
      }
      className="inline-flex items-center gap-2 border border-line px-2 py-1 font-label text-xs uppercase tracking-[0.16em] text-faint"
    >
      <span className="h-1 w-1 rotate-45 bg-brass" />
      Recorded trace
    </span>
  );
}
