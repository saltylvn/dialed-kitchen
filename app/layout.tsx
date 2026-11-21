import type { Metadata, Viewport } from "next";
import { DM_Mono, Inter } from "next/font/google";
import { connection } from "next/server";
import { ICON_VERSION } from "@/lib/iconVersion";
import "./globals.css";

// Two free Google Fonts, served from our own domain by next/font (docs/decisions/0050):
// Inter for everything readable (a variable font: one file covers every weight), and
// DM Mono for small uppercase labels only.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400"],
});

// <head> info: the browser tab title, and what iPhone Safari reads on "Add to Home Screen".
export const metadata: Metadata = {
  title: "Dialed Kitchen",
  description: "Grocery lists, best prices, recipes and meal planning.",
  // The fork icon as plain PNG files in public/ (made by `npm run icons` from
  // assets/app-icon.svg). ?v= makes phones fetch a fresh copy after a change.
  icons: {
    icon: [
      { url: `/icon-192.png?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
      { url: `/icon-512.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true, // opens full-screen (no Safari toolbars) from the home screen
    title: "Dialed Kitchen", // label under the home-screen icon
    statusBarStyle: "default", // dark status-bar text on the white background
  },
};

// How the page fits the phone screen. Light mode only, even when the phone is set to dark.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let the page extend under the notch / home bar
  colorScheme: "light",
  themeColor: "#ffffff", // white status-bar area, matching --bg
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request (not once at build time), so each page's scripts get
  // that request's CSP nonce (proxy.ts). The app is per-user, so pages are dynamic anyway.
  await connection();

  return (
    <html lang="en" className={`${inter.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
