import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/server/supabase";

// Google sends the browser back here with a one-time code. Supabase trades it (plus the
// PKCE check code saved in a cookie when sign-in started) for a session cookie.
// Always redirects to a fixed path on this site, never to a URL taken from the request,
// so this route can't be used to send people to another site (open redirect).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
    console.error("Sign-in callback failed:", error.message);
  }
  return NextResponse.redirect(new URL("/login?error=signin", request.url));
}
