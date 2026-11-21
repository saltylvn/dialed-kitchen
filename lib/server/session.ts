import { NextResponse, type NextRequest } from "next/server";
import { hardenAuthCookie } from "../security/cookies";
import { RETURN_TO_COOKIE, RETURN_TO_MAX_AGE_SECONDS, safeReturnPath } from "../security/returnTo";
import { neonAuth } from "./neonAuth";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Pages (and the one webhook) anyone can reach while signed out.
const PUBLIC_PATHS = [
  "/login",
  "/waitlist",
  "/auth/google",
  "/auth/callback",
  "/webhooks/neon-auth",
];

// Called by proxy.ts on every page request. Neon Auth's middleware does the session work:
//  1. finishes a Google sign-in (trades the one-time code in the address for login cookies),
//  2. refreshes the login session when it is about to expire, and
//  3. sends signed-out visitors to /login.
// `extraRequestHeaders` (the CSP) are added to the request the page renders with.
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string>,
): Promise<NextResponse> {
  // The middleware passes the request's headers on to the page, so set ours first.
  for (const [key, value] of Object.entries(extraRequestHeaders)) request.headers.set(key, value);

  const middleware = neonAuth().middleware({ loginUrl: "/login", publicRoutes: PUBLIC_PATHS });
  const response = await middleware(request);

  const { pathname } = request.nextUrl;
  const location = response.headers.get("location");
  const sentToLogin =
    location !== null &&
    pathname !== "/login" &&
    new URL(location, request.url).pathname === "/login";
  if (!sentToLogin) return response;

  // Our own redirect to a bare /login (the middleware's copy carries the page's query
  // string along, which a sign-in page has no use for), keeping any cookies it set.
  const redirect = NextResponse.redirect(new URL("/login", request.url));
  for (const cookie of response.headers.getSetCookie())
    redirect.headers.append("Set-Cookie", cookie);
  // Signed out on an invite link: come back to it after signing in (lib/security/returnTo).
  const returnTo = safeReturnPath(pathname);
  if (returnTo) {
    redirect.cookies.set(RETURN_TO_COOKIE, returnTo, {
      ...hardenAuthCookie({ path: "/" }, IS_PRODUCTION),
      maxAge: RETURN_TO_MAX_AGE_SECONDS,
    });
  }
  return redirect;
}
