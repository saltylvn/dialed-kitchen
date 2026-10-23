"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/server/supabase";

// Sign-in starts at app/auth/google (a plain form post, see the note there); signing out
// stays on our own site, so it's a regular server action.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
