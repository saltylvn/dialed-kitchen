import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_DEVICE_COOKIE } from "@/lib/device";
import { hardenAuthCookie } from "@/lib/security/cookies";
import { isSameOrigin } from "@/lib/security/sameOrigin";
import { demoEmail, demoPassword } from "@/lib/server/demo";
import { neonAuth } from "@/lib/server/neonAuth";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// "Try the demo" (docs/decisions/0026): signs into the shared demo household with the
// server-only password. A plain form posts here, like "Continue with Google", so the browser
// follows the redirects itself and the address bar ends on the app, not on /auth/callback
// (a server action left it there, and "Leave demo" then posted to the callback and failed).
// The callback refreshes the demo's sample data: that needs the new login cookie, which only
// exists from the next request on.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.url)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const failed = () => NextResponse.redirect(new URL("/login?error=signin", request.url), 303);

  const password = demoPassword();
  if (!password) return failed();
  const { error } = await neonAuth().signIn.email({ email: demoEmail, password });
  if (error) {
    console.error("Demo sign-in failed:", error.message);
    return failed();
  }
  // Lets the demo open on a laptop too (lib/device.ts, docs/decisions/0056).
  (await cookies()).set(DEMO_DEVICE_COOKIE, "1", {
    ...hardenAuthCookie({ path: "/" }, IS_PRODUCTION),
    maxAge: 60 * 60 * 24 * 7,
  });
  // 303 See Other: the browser follows with a GET, as it should after a form post.
  return NextResponse.redirect(new URL("/auth/callback", request.url), 303);
}
