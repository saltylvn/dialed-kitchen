import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "../env";
import { hardenAuthCookie } from "../security/cookies";
import { RETURN_TO_COOKIE, RETURN_TO_MAX_AGE_SECONDS, safeReturnPath } from "../security/returnTo";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Pages anyone can open while signed out.
const PUBLIC_PATHS = ["/login", "/auth/google", "/auth/callback"];
const HOME = "/";

// Called by proxy.ts on every page request:
//  1. refreshes the login session (Supabase tokens expire and must be renewed), and
//  2. sends signed-out visitors to /login, and signed-in ones away from it.
// `extraRequestHeaders` (the CSP) are added to the request the page renders with.
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string>,
): Promise<NextResponse> {
  const { url, publishableKey } = getSupabaseEnv();

  // Rebuilt after cookies change, so the page sees the refreshed session and the CSP.
  const nextResponse = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value);
    return NextResponse.next({ request: { headers } });
  };
  let response = nextResponse();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = nextResponse();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenAuthCookie(options, IS_PRODUCTION));
        }
        // Stops CDNs from caching a response that carries someone's login cookies.
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  // Must come right after createServerClient: this is what refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!isSignedIn && !isPublic) {
    const redirect = redirectKeepingCookies(request, response, "/login");
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
  if (isSignedIn && pathname === "/login") return redirectKeepingCookies(request, response, HOME);
  return response;
}

// A redirect must carry along any refreshed login cookies and no-cache headers.
function redirectKeepingCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}
