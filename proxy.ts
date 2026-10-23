import type { NextRequest } from "next/server";
import { getSupabaseEnv } from "./lib/env";
import { buildCsp, createNonce } from "./lib/security/csp";
import { updateSession } from "./lib/server/session";

// Runs before every page request:
//  1. Content Security Policy with a one-time nonce. Next.js reads the nonce from the
//     request's CSP header and adds it to its own scripts, so they run and anything
//     injected without it doesn't (docs/decisions/0006).
//  2. Login session refresh and the signed-in check (lib/server/session.ts).
export async function proxy(request: NextRequest) {
  const csp = buildCsp({
    nonce: createNonce(),
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: getSupabaseEnv().url,
  });

  const response = await updateSession(request, { "Content-Security-Policy": csp });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: static files, images and the icon don't need a CSP or a session.
      source: "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
      // Link prefetches aren't rendered as pages, so they skip this too.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
