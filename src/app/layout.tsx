import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

// No approved display face exists in the Farm to Fame repositories yet; Barlow
// Condensed is the closest match to the condensed display type in the approved
// Player Registry screens, with Inter for body/UI text.
const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const TITLE = "Available Players | Farm to Fame";
const DESCRIPTION =
  "Explore the 2026–27 Farm to Fame Player Registry — 142 returning players with 2025–26 NHL stats, Yahoo ADP, filters, and player profiles.";
const SHARE_IMAGE = {
  url: "/brand/og-available-players.jpg",
  width: 1200,
  height: 671,
  alt: "Farm to Fame 2026–2027 Player Registry: Available Players, with Macklin Celebrini, Lane Hutson and Gavin McKenna",
};

export const metadata: Metadata = {
  // Share cards and the canonical link need absolute URLs; this is the site's
  // public address, not an input to page behaviour.
  metadataBase: new URL("https://players.farmtofame.com"),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Farm to Fame",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3efe5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
