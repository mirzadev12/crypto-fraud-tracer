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
  tone = "default",
  className = "",
}: {
  address: string;
  full?: boolean;
  copy?: boolean;
  explorer?: boolean;
  tone?: "default" | "brand" | "strong";
  className?: string;
}) {
  const tones = {
    default: "text-muted",
    brand: "text-brand",
    strong: "text-ink",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`font-mono text-[13px] tracking-tight ${tones[tone]} ${full ? "break-all" : ""}`}
        title={address}
      >
        {full ? address : shortAddress(address)}
      </span>
      {copy ? <CopyButton value={address} label="" /> : null}
      {explorer ? (
        <a
          href={tronscanAddressUrl(address)}
          target="_blank"
          rel="noreferrer noopener"
          title="Open in block explorer"
          aria-label={`Open ${address} in a public block explorer`}
          className="rounded-md p-1 text-faint transition hover:bg-white/5 hover:text-brand"
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
  );
}
