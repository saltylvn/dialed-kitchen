import type { MetadataRoute } from "next";
import { ICON_VERSION } from "../lib/iconVersion"; // relative, so a unit test can load this file

// The "web app manifest": tells the phone this website can be installed
// and how it should look when launched from the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dialed Kitchen",
    short_name: "Dialed Kitchen",
    description: "Grocery lists, best prices, recipes and meal planning.",
    start_url: "/plan",
    display: "standalone", // full-screen, like a native app
    background_color: "#faf9f5", // cream while the app opens, matching --bg
    theme_color: "#faf9f5",
    // Newer iPhones take the home-screen icon from here, so the 180×180 size comes first.
    icons: [
      {
        src: `/apple-touch-icon.png?v=${ICON_VERSION}`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-192.png?v=${ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
