import type { Metadata, Viewport } from "next";
import { Lora, Poppins } from "next/font/google";
import "./globals.css";

// Free Google Fonts close to Anthropic's own (paid) typefaces:
// Poppins for headings, Lora for body text.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${lora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
