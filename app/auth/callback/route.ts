import { NextResponse, type NextRequest } from "next/server";
import { RETURN_TO_COOKIE, safeReturnPath } from "@/lib/security/returnTo";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/db";
import { HOME_TAB } from "@/lib/tabs";

// Every sign-in ends here: Google (through Neon Auth) sends the browser back to this
// address, and the demo sign-in redirects to it. By the time this runs, proxy.ts
// has already traded the one-time code in the address for login cookies, so all that is
// left is to finish a new person's sign-up and send them on.
// Redirects only to fixed paths on this site, or to an allow-listed return path (an invite
// link the person opened while signed out), never to a URL taken from the request, so this
// route can't be used to send people to another site (open redirect).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    // Gives a new account its household and uses up its invite code. Neon Auth's
    // "user.created" webhook does the same; whichever arrives first wins, the other
    // changes nothing (docs/decisions/0049).
    const db = await createClient();
    const { error } = await db.rpc("finish_my_signup");
    if (error) {
      console.error("finish_my_signup failed:", error.message);
      return NextResponse.redirect(new URL("/login?error=signin", request.url));
    }
    // The shared demo's sample data resets once a day, on sign-in (docs/decisions/0026).
    // For everyone else this does nothing.
    const { error: refreshError } = await db.rpc("refresh_demo_if_stale");
    if (refreshError) console.error("Demo refresh failed:", refreshError.message);

    const returnTo = safeReturnPath(request.cookies.get(RETURN_TO_COOKIE)?.value);
    const response = NextResponse.redirect(new URL(returnTo ?? HOME_TAB.href, request.url));
    response.cookies.delete(RETURN_TO_COOKIE); // single use
    return response;
  }

  // No session: sign-in failed. When Neon Auth refused to create a new account (our
  // webhook said no), say why: the 25-account limit (docs/decisions/0025), or no redeemed
  // invite code for this email (docs/decisions/0043), instead of "try again".
  if (request.nextUrl.searchParams.has("error")) {
    console.error("Sign-in callback error:", request.nextUrl.searchParams.get("error"));
    const reason = (await acceptingNewAccounts()) ? "invite" : "full";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=signin", request.url));
}

async function acceptingNewAccounts(): Promise<boolean> {
  const db = await createClient();
  const { data, error } = await db.rpc("accepting_new_accounts");
  if (error) {
    console.error("accepting_new_accounts failed:", error.message);
    return true; // unknown: fall back to the general message
  }
  return data === true;
}
