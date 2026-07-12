import type { Metadata } from "next";
import localFont from "next/font/local";
import { Barlow } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/app.css";

const din = localFont({
  src: "../src/fonts/DINCondensed-Bold.ttf",
  weight: "700",
  variable: "--font-din",
  display: "swap",
});

const luster = localFont({
  src: "../src/fonts/LusterBrush.otf",
  weight: "400",
  variable: "--font-luster",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAP Trellis",
  description:
    "Open-source client intake, eligibility, and service management for Community Action Agencies — CSBG Annual Report 3.0 (OMB 0970-0492)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // font variables must live on <html> — tokens.css composes them into
    // --font-h1/--font-body at :root, which can't see body-level variables
    <html lang="en" className={`${din.variable} ${luster.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
