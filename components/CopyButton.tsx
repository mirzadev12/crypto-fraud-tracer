"use client";

import { useEffect, useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard permission can be denied; fall back to a selection prompt so
      // the officer can still get the value out of the screen.
      window.prompt("Copy this value", value);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `${label} ${value}`}
      title={copied ? "Copied" : label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-faint transition hover:bg-white/5 hover:text-brand ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="m5 10.5 3.5 3.5L15 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <rect
            x="7"
            y="7"
            width="9"
            height="9"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4H5.5A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
