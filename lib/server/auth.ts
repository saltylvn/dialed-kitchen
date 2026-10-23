import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase";

export type CurrentUser = { id: string; email: string | null };

// Who is signed in, checked once per request (cache) no matter how many components ask.
// getClaims() verifies the login token's signature, so the result can be trusted.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  // Only the fields the app needs, never the whole token.
  return { id: data.claims.sub, email: data.claims.email ?? null };
});

// For pages and actions that need a signed-in user. proxy.ts already redirects signed-out
// visitors; this second check means a page stays protected even if the proxy is bypassed.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
