import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Poppins } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// Two free Google Fonts, served from our own domain by next/font (docs/decisions/0008):
// Poppins for the wordmark, text and buttons (sturdy and readable in sunlight), and
// Cormorant Garamond light italic for large display headlines only.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300"],
  style: ["italic"],
});

// <head> info: the browser tab title, and what iPhone Safari reads on "Add to Home Screen".
export const metadata: Metadata = {
  title: "Dialed Kitchen",
  description: "Grocery lists, best prices, recipes and meal planning.",
  appleWebApp: {
    capable: true, // opens full-screen (no Safari toolbars) from the home screen
    title: "Dialed Kitchen", // label under the home-screen icon
    statusBarStyle: "default", // dark status-bar text on our cream background
  },
};

// How the page fits the phone screen. Light mode only, even when the phone is set to dark.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let the page extend under the notch / home bar
  colorScheme: "light",
  themeColor: "#faf9f5", // cream status-bar area, matching --bg
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request (not once at build time), so each page's scripts get
  // that request's CSP nonce (proxy.ts). The app is per-user, so pages are dynamic anyway.
  await connection();

  return (
    <html lang="en" className={`${poppins.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
