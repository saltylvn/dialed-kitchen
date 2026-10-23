import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "./lib/security/csp";

// Runs before every page request: creates a one-time nonce and sends the Content Security
// Policy. Next.js reads the nonce from the request's CSP header and adds it to its own
// scripts, so they run and anything injected without it doesn't.
export function proxy(request: NextRequest) {
  const csp = buildCsp({ nonce: createNonce(), isDev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: static files, images and the icon don't need a CSP.
      source: "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
      // Link prefetches aren't rendered as pages, so they skip this too.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
