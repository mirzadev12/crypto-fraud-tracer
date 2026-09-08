import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, IBM_Plex_Mono, Inter } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

/* Four faces, each with one job:
   Cinzel      — section titles only, sparingly. Inscriptional, not decorative.
   Cormorant   — the printed evidence packet, where a document voice belongs.
   Inter       — every functional surface: UI, body, labels.
   IBM Plex Mono — addresses, hashes, figures. Data is always monospaced. */

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

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "FineX // Blockchain Intelligence",
    template: "%s · FineX",
  },
  description:
    "Trace fraud-linked wallets, follow the money hop by hop, and attribute the exit to an exchange deposit cluster.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plexMono.variable} ${cinzel.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
