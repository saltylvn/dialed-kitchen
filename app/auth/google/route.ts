import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/security/sameOrigin";
import { createClient } from "@/lib/server/supabase";

// "Continue with Google": the sign-in form posts here as a plain form (not a server action),
// so the browser simply follows the redirects (here → Supabase → Google) as a normal page
// change, and never has to fetch an outside site, which the CSP's connect-src forbids.
//
// Supabase returns Google's sign-in address and stores a one-time PKCE check code in a
// cookie; Google then returns to /auth/callback, which finishes sign-in.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.url)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback", request.url).toString() },
  });

  if (error || !data.url) {
    console.error("Google sign-in could not start:", error?.message);
    return NextResponse.redirect(new URL("/login?error=signin", request.url), 303);
  }
  // 303 See Other: the browser follows with a GET, as it should after a form post.
  return NextResponse.redirect(data.url, 303);
}
