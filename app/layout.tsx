import type { Metadata } from "next";
import {
  Cinzel,
  Cormorant_Garamond,
  IBM_Plex_Mono,
  Inter,
  Noto_Sans_Devanagari,
  Saira,
} from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

/* Five faces, each with one job:
   Cinzel      — section titles only, sparingly. Inscriptional, not decorative.
   Cormorant   — the printed evidence packet, where a document voice belongs.
   Inter       — every functional surface: UI, body, labels.
   IBM Plex Mono — addresses, hashes, figures. Data is always monospaced.
   Saira       — the small uppercase labels that run the interface.

   On Saira: the brief asked for Eurostile, which is a licensed Linotype face
   and cannot be shipped here. Saira is the closest freely-licensed technical
   square-grotesque with a full weight range and it holds up at 12px, which the
   display faces do not. Swap `--font-label` if a licensed Eurostile is ever
   available — nothing else has to change. */

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* Devanagari, for the Hindi help page (and any Hindi a sheet carries). A
   fallback in every stack, never a face of its own: Latin text keeps its face,
   and the file is fetched only when Devanagari is on screen — it is limited to
   that script's range and not preloaded. */
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600"],
  preload: false,
});

const DESCRIPTION =
  "Trace fraud-linked wallets, follow the money hop by hop, and attribute the exit to an exchange deposit cluster.";

export const metadata: Metadata = {
  /* Where absolute links in the head point — the preview image above all.
     Render sets RENDER_EXTERNAL_URL for a web service; the fallback is the
     deployment itself, so a link shared from anywhere unfolds into the card. */
  metadataBase: new URL(
    process.env.RENDER_EXTERNAL_URL ?? "https://crypto-fraud-tracer.onrender.com",
  ),
  title: {
    default: "FineX // Blockchain Intelligence",
    template: "%s · FineX",
  },
  description: DESCRIPTION,
  applicationName: "FineX",
  openGraph: {
    type: "website",
    siteName: "FineX",
    title: "FineX // Blockchain Intelligence",
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "FineX // Blockchain Intelligence",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plexMono.variable} ${cinzel.variable} ${cormorant.variable} ${saira.variable} ${devanagari.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
