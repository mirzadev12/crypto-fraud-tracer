import type { ReactNode } from "react";
import type { TriageLevel } from "@/lib/types";

/* ------------------------------------------------------------------ layout */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">
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
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs leading-5 text-faint">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------- stats */

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
  const toneRing: Record<string, string> = {
    default: "border-line",
    brand: "border-brand/30",
    hot: "border-hot/35",
    warm: "border-warm/35",
    cold: "border-cold/25",
  };
  const toneText: Record<string, string> = {
    default: "text-ink",
    brand: "text-brand",
    hot: "text-hot",
    warm: "text-warm",
    cold: "text-cold",
  };
  return (
    <div className={`rounded-2xl border bg-surface p-5 ${toneRing[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-2xl font-semibold tabular-nums ${toneText[tone]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted">{hint}</p> : null}
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
  const pad = size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-[11px]";
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Attribution provenance — we show our uncertainty rather than hide it. */
export function SourceChip({ source }: { source: string }) {
  const map: Record<string, { text: string; tone: "brand" | "warm" | "hot" | "neutral"; title: string }> = {
    ground_truth: {
      text: "Ground truth",
      tone: "brand",
      title: "Public block-explorer tag — treated as fact.",
    },
    heuristic: {
      text: "Heuristic",
      tone: "warm",
      title: "Derived by sweep-pattern clustering over public data.",
    },
    sanctions: {
      text: "Sanctions list",
      tone: "hot",
      title: "Published sanctions listing (e.g. OFAC SDN).",
    },
    community: {
      text: "Community report",
      tone: "neutral",
      title: "Crowd-sourced abuse report — lowest confidence tier.",
    },
  };
  const meta = map[source] ?? { text: source, tone: "neutral" as const, title: source };
  return (
    <Chip tone={meta.tone} title={meta.title}>
      {meta.text}
    </Chip>
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
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
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
    <div className="rounded-xl border border-hot/30 bg-hot/[0.06] px-6 py-8 text-center">
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
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: `${BUTTON_BASE} bg-brand text-[#04121a] hover:bg-cyan-300`,
  secondary: `${BUTTON_BASE} border border-line bg-surface-2 text-ink hover:border-brand/40 hover:text-brand`,
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
