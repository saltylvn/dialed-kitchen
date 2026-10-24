import { NextResponse, type NextRequest } from "next/server";
import { RETURN_TO_COOKIE, safeReturnPath } from "@/lib/security/returnTo";
import { createClient } from "@/lib/server/supabase";
import { HOME_TAB } from "@/lib/tabs";

// Google sends the browser back here with a one-time code. Supabase trades it (plus the
// PKCE check code saved in a cookie when sign-in started) for a session cookie.
// Redirects only to fixed paths on this site, or to an allow-listed return path (an invite
// link the person opened while signed out), never to a URL taken from the request, so this
// route can't be used to send people to another site (open redirect).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const returnTo = safeReturnPath(request.cookies.get(RETURN_TO_COOKIE)?.value);
      const response = NextResponse.redirect(new URL(returnTo ?? HOME_TAB.href, request.url));
      response.cookies.delete(RETURN_TO_COOKIE); // single use
      return response;
    }
    console.error("Sign-in callback failed:", error.message);
  }

  // Supabase sends an error instead of a code when it couldn't create a new account. If the
  // 25-account limit is why (docs/decisions/0025), say so instead of "try again".
  const description = request.nextUrl.searchParams.get("error_description") ?? "";
  if (!code && /saving new user/i.test(description) && !(await acceptingNewAccounts())) {
    return NextResponse.redirect(new URL("/login?error=full", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=signin", request.url));
}

async function acceptingNewAccounts(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accepting_new_accounts");
  if (error) {
    console.error("accepting_new_accounts failed:", error.message);
    return true; // unknown: fall back to the general message
  }
  return data === true;
}
