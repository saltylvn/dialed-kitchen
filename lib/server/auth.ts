import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { neonAuth } from "./neonAuth";

export type CurrentUser = { id: string; email: string | null };

// Who is signed in, checked once per request (cache) no matter how many components ask.
// getSession() reads the login cookie and either verifies this app's signed, short-lived
// copy of the session or asks Neon Auth, so the result can be trusted.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { data, error } = await neonAuth().getSession();
  if (error || !data?.user?.id) return null;
  // Only the fields the app needs, never the whole session.
  return { id: data.user.id, email: data.user.email ?? null };
});

// For pages and actions that need a signed-in user. proxy.ts already redirects signed-out
// visitors; this second check means a page stays protected even if the proxy is bypassed.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
