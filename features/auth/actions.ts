"use server";

import { redirect } from "next/navigation";
import { demoEmail, demoPassword } from "@/lib/server/demo";
import { createClient } from "@/lib/server/supabase";
import { HOME_TAB } from "@/lib/tabs";

// Sign-in starts at app/auth/google (a plain form post, see the note there); signing out
// stays on our own site, so it's a regular server action.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// "Try the demo" (docs/decisions/0026): signs into the shared demo household with the
// server-only password, refreshes its sample data once a day, and opens the Plan tab.
export async function signInAsDemo() {
  const password = demoPassword();
  if (!password) redirect("/login?error=signin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password });
  if (error) {
    console.error("Demo sign-in failed:", error.message);
    redirect("/login?error=signin");
  }
  const { error: refreshError } = await supabase.rpc("refresh_demo_if_stale");
  if (refreshError) console.error("Demo refresh failed:", refreshError.message);
  redirect(HOME_TAB.href);
}
