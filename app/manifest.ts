import type { MetadataRoute } from "next";

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
  };
}
