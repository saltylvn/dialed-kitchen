"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server/supabase";

// "Continue with Google", started on the server: Supabase returns Google's sign-in address
// (and stores a one-time PKCE check code in a cookie), and we send the browser there.
// Google then returns to /auth/callback. Running this on the server means the browser
// never downloads the Supabase library.
export async function signInWithGoogle() {
  // Next.js only accepts server actions whose Origin matches this site (built-in CSRF
  // protection), so the Origin header is trustworthy here. Supabase also only redirects
  // to the URLs on its allow list.
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    console.error("Google sign-in could not start:", error?.message);
    redirect("/login?error=signin");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
