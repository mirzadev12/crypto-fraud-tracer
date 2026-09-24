import Link from "next/link";
import { shortAddress, tronscanAddressUrl } from "@/lib/format";
import CopyButton from "./CopyButton";

/**
 * The address is the evidence. It is always monospaced, always copyable, and
 * always one click from the public explorer so a judge or an exchange
 * compliance desk can verify it independently.
 */
export default function AddressChip({
  address,
  full = false,
  copy = true,
  explorer = true,
  origin = true,
  quiet = false,
  tone = "default",
  className = "",
}: {
  address: string;
  full?: boolean;
  copy?: boolean;
  explorer?: boolean;
  /** Link to this wallet's own origin card. Off where it would be self-referential. */
  origin?: boolean;
  /**
   * For a table of many addresses: the icons stay out of sight until the row
   * (a `group`) is pointed at or one of them takes keyboard focus. Twenty rows
   * of three icons each is noise; one row's worth, where the cursor is, is a
   * tool. Only on devices that can hover — a touch screen always shows them.
   */
  quiet?: boolean;
  tone?: "default" | "brand" | "strong";
  className?: string;
}) {
  const tones = {
    default: "text-muted",
    brand: "text-brass",
    strong: "text-ink",
  };
  const icons = quiet
    ? "inline-flex items-center gap-2 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100"
    : "contents";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`font-mono text-[13px] tracking-tight ${tones[tone]} ${full ? "break-all" : "whitespace-nowrap"}`}
        title={address}
      >
        {full ? address : shortAddress(address)}
      </span>
      <span className={icons}>
      {copy ? <CopyButton value={address} label="" /> : null}
      {origin ? (
        /* Every address in the app is now one click from what funded it. The
           trace answers where the money went; this answers where it came
           from, and an investigator asks both of a node on the graph. */
        <Link
          href={`/wallet/${encodeURIComponent(address)}`}
          title="Where this wallet came from"
          aria-label={`Origin and counterparties for ${address}`}
          className="p-1 text-faint transition hover:bg-white/5 hover:text-brass"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M4 4v3a2 2 0 0 0 2 2h8M16 4v3a2 2 0 0 1-2 2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M10 9v7m0 0-2.5-2.5M10 16l2.5-2.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : null}
      {explorer ? (
        <a
          href={tronscanAddressUrl(address)}
          target="_blank"
          rel="noreferrer noopener"
          title="Open in block explorer"
          aria-label={`Open ${address} in a public block explorer`}
          className="p-1 text-faint transition hover:bg-white/5 hover:text-brass"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M11 4h5v5M16 4l-6.5 6.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ) : null}
      </span>
    </span>
  );
}
