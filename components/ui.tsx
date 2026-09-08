import type { ReactNode } from "react";
import type { TriageLevel } from "@/lib/types";

/* ------------------------------------------------------- instrument chrome */

/**
 * Four corner brackets. Purely decorative — it is the detail that makes a panel
 * read as an instrument rather than a card. The parent must be `relative`.
 */
export function Corners({ className = "" }: { className?: string }) {
  const arms = [
    "left-0 top-0 border-l border-t",
    "right-0 top-0 border-r border-t",
    "left-0 bottom-0 border-l border-b",
    "right-0 bottom-0 border-r border-b",
  ];
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {arms.map((arm) => (
        <span key={arm} className={`absolute h-2.5 w-2.5 border-line ${arm}`} />
      ))}
    </div>
  );
}

/**
 * Section gutter: index on the left, label on the right, hairline between.
 *
 *   [ 02 / 04 ] ───────────────────────────────── [ FUND FLOW ]
 */
export function Gutter({
  index,
  label,
  className = "",
}: {
  index?: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 font-mono text-xs uppercase tracking-[0.28em] text-faint ${className}`}
    >
      {index ? <span className="shrink-0">[ {index} ]</span> : null}
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0">[ {label} ]</span>
    </div>
  );
}

/* ------------------------------------------------------------------ layout */

/** Chrome gets no accent colour — hue is reserved for triage. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-faint">
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
    <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <SectionLabel>{eyebrow}</SectionLabel>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  code,
  actions,
  corners = false,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Mono reference shown right-aligned in the header, e.g. a case id. */
  code?: ReactNode;
  actions?: ReactNode;
  corners?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-panel border border-line bg-surface ${className}`}
    >
      {corners ? <Corners /> : null}
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs leading-5 text-faint">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            {code ? (
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
                {code}
              </span>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------- stats */

/**
 * Institutional number treatment: the figure is the loudest thing in the card,
 * set light and monospaced, with the fractional part dropped back so the eye
 * lands on the magnitude first. Values without a decimal render unchanged.
 */
function Figure({ value }: { value: string }) {
  const cut = value.lastIndexOf(".");
  if (cut === -1) return <>{value}</>;
  return (
    <>
      {value.slice(0, cut)}
      <span className="text-faint">{value.slice(cut)}</span>
    </>
  );
}

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
  // Every card carries the same hairline. Only a HOT or WARM figure takes hue —
  // colour on this screen means triage and nothing else.
  const toneText: Record<string, string> = {
    default: "text-ink",
    brand: "text-ink",
    cold: "text-ink",
    hot: "text-hot",
    warm: "text-warm",
  };
  // A count of 4 and a figure of 251,650.00 cannot take the same size in a
  // four-across grid; step down once the string gets long rather than clipping.
  const size =
    value.length > 9
      ? "text-3xl md:text-4xl"
      : value.length > 6
        ? "text-4xl md:text-5xl"
        : "text-5xl md:text-6xl";
  return (
    <div className="rounded-panel border border-line bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
        {label}
      </p>
      <p
        className={`mt-3 font-mono font-light tabular-nums tracking-tight ${size} ${toneText[tone]}`}
      >
        <Figure value={value} />
      </p>
      {hint ? <p className="mt-3 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ triage */

export const TRIAGE_META: Record<
  TriageLevel,
  { label: string; action: string; chip: string; dot: string; text: string; ring: string }
> = {
  HOT: {
    label: "HOT",
    action: "Act now — funds still at rest",
    chip: "border-hot/40 bg-hot/12 text-hot",
    dot: "bg-hot",
    text: "text-hot",
    ring: "border-hot/40",
  },
  WARM: {
    label: "WARM",
    action: "Freeze request viable",
    chip: "border-warm/40 bg-warm/12 text-warm",
    dot: "bg-warm",
    text: "text-warm",
    ring: "border-warm/40",
  },
  COLD: {
    label: "COLD",
    action: "Document and close",
    chip: "border-cold/35 bg-cold/10 text-cold",
    dot: "bg-cold",
    text: "text-cold",
    ring: "border-cold/35",
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
  const pad = size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold uppercase tracking-[0.12em] ${meta.chip} ${pad}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${level === "HOT" ? "tx-pulse" : ""}`}
      />
      {meta.label}
      {withAction ? (
        <span className="font-normal normal-case tracking-normal opacity-80">
          · {meta.action}
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
    neutral: "border-line bg-surface-2 text-muted",
    brand: "border-brand/30 bg-brand/10 text-brand",
    hot: "border-hot/35 bg-hot/10 text-hot",
    warm: "border-warm/35 bg-warm/10 text-warm",
    cold: "border-cold/30 bg-cold/10 text-cold",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Attribution provenance — we show our uncertainty rather than hide it.
 *
 * Outlined mono, no fill, no hue: the tier is stated in words, and colour on
 * this screen is reserved for triage.
 */
export function SourceChip({ source }: { source: string }) {
  const map: Record<string, { text: string; title: string }> = {
    ground_truth: {
      text: "Ground truth",
      title: "Public block-explorer tag — treated as fact.",
    },
    heuristic: {
      text: "Heuristic",
      title: "Derived by sweep-pattern clustering over public data.",
    },
    sanctions: {
      text: "Sanctions list",
      title: "Published sanctions listing (e.g. OFAC SDN).",
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
      className="inline-flex items-center rounded-panel border border-line px-2 py-0.5 font-mono text-xs uppercase tracking-[0.16em] text-faint"
    >
      {meta.text}
    </span>
  );
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
    <div className="flex min-h-56 flex-col items-center justify-center rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-faint">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
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
    <div className="rounded-panel border border-hot/30 bg-hot/[0.06] px-6 py-8 text-center">
      <p className="text-sm font-semibold text-hot">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className}`}
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
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- buttons */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-panel px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: `${BUTTON_BASE} bg-ink text-bg hover:bg-white`,
  secondary: `${BUTTON_BASE} border border-line bg-surface-2 text-ink hover:border-faint`,
  ghost: `${BUTTON_BASE} text-muted hover:bg-white/5 hover:text-ink`,
};

/* ------------------------------------------------------------ data source */

export function DataSourceBadge({
  source,
  note,
}: {
  source: "live" | "demo";
  note?: string;
}) {
  if (source === "live") {
    return (
      <Chip tone="brand" title="Served by the trace API on this deployment.">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        Live API
      </Chip>
    );
  }
  return (
    <Chip
      tone="warm"
      title={note ?? "Serving committed fixtures from /public/mock."}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warm" />
      Demo data
    </Chip>
  );
}
