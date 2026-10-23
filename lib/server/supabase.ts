import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "../env";

// A Supabase client for server code (pages, server actions, route handlers), acting as
// the signed-in user: it carries their session cookie, so row-level security applies.
// Create one per request; never share one between requests (or users).
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Pages can't write cookies; proxy.ts already refreshed the session for this request.
        }
      },
    },
  });
}
