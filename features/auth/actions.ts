"use server";

import { redirect } from "next/navigation";
import { demoEmail, demoPassword } from "@/lib/server/demo";
import { neonAuth } from "@/lib/server/neonAuth";

// Sign-in starts at app/auth/google (a plain form post, see the note there); signing out
// stays on our own site, so it's a regular server action.
export async function signOut() {
  const { error } = await neonAuth().signOut();
  if (error) console.error("Sign-out failed:", error.message);
  redirect("/login");
}

// "Try the demo" (docs/decisions/0026): signs into the shared demo household with the
// server-only password, then goes through /auth/callback like any other sign-in. The
// callback refreshes the demo's sample data: that needs the new login cookie, which only
// exists from the next request on.
export async function signInAsDemo() {
  const password = demoPassword();
  if (!password) redirect("/login?error=signin");
  const { error } = await neonAuth().signIn.email({ email: demoEmail, password });
  if (error) {
    console.error("Demo sign-in failed:", error.message);
    redirect("/login?error=signin");
  }
  redirect("/auth/callback");
}
