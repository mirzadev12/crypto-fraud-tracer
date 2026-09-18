import { ImageResponse } from "next/og";
import depositAddresses from "@/data/deposit-addresses.json";
import hotWallets from "@/data/hot-wallets.json";
import riskLists from "@/data/risk-lists.json";

/**
 * The card a shared link unfolds into — in a chat, an email, a slide's link
 * preview. Without it a link to the deployment arrived as a bare URL.
 *
 * The figures are counted from the committed data files when the image is
 * built, never typed: a number on a picture drifts from the file under it
 * even more quietly than one in prose. It names no organisation it does not
 * belong to — the problem statement is cited, not claimed.
 */
export const alt = "FineX — from a victim's wallet to the exchange account that can be frozen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#f0ead8";
const MUTED = "#a8a296";
const FAINT = "#9a948a";
const BRASS = "#c6a15b";
const BRASS_DIM = "#7a6338";
const BG = "#0a0a0a";

export default function OpengraphImage() {
  const deposits = (depositAddresses as Array<{ exchange: string }>).length;
  const exchanges = new Set((depositAddresses as Array<{ exchange: string }>).map((d) => d.exchange)).size;
  const seeds = (hotWallets as unknown[]).length;
  const sanctioned = ((riskLists as { sanctioned?: unknown[] }).sanctioned ?? []).length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "64px 72px",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 18,
              height: 18,
              border: `3px solid ${BRASS}`,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 26, letterSpacing: 10, color: INK }}>FINEX</div>
          <div style={{ fontSize: 20, letterSpacing: 6, color: FAINT }}>
            BLOCKCHAIN INTELLIGENCE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, lineHeight: 1.12, color: INK }}>From a victim&rsquo;s wallet</div>
          <div style={{ fontSize: 64, lineHeight: 1.12, color: INK }}>to the exchange account</div>
          <div style={{ fontSize: 64, lineHeight: 1.12, color: BRASS }}>that can be frozen.</div>
          <div style={{ marginTop: 40, width: 420, height: 2, background: BRASS_DIM, display: "flex" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 28, color: MUTED }}>
            {`${deposits} customer deposit addresses · ${exchanges} exchanges · ${sanctioned} sanctioned addresses`}
          </div>
          <div style={{ fontSize: 22, color: FAINT }}>
            {`Derived from ${seeds} tagged exchange wallets, using public data only`}
          </div>
          <div style={{ fontSize: 22, color: FAINT }}>TRON · USDT (TRC-20) · SIH 2026 · PS 26183</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
