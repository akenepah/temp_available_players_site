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

export const metadata: Metadata = {
  title: "Available Players · Farm to Fame",
  description: "Players returning to the Farm to Fame 2026–27 draft, with 2025–26 NHL statistics and Yahoo ADP.",
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
