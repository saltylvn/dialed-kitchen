import type { NextConfig } from "next";

// Security headers sent with every response. (The Content Security Policy needs a fresh
// nonce per request, so it's set in proxy.ts instead.)
const securityHeaders = [
  // Browsers must use https for this site for the next 2 years, even if someone types http://.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Don't guess file types: a file served as text is never run as a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our domain in links from the app, never full URLs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Turn off device features the app doesn't use. Camera stays on for us alone (recipe photos).
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Old-browser backup for the CSP's frame-ancestors: never show the app inside a frame.
  { key: "X-Frame-Options", value: "DENY" },
  // Pages opened from the app (recipe sites) can't reach back into its window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework to attackers
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
