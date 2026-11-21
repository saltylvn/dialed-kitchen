"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_DEVICE_COOKIE } from "@/lib/device";
import { neonAuth } from "@/lib/server/neonAuth";

// Sign-in starts at app/auth/google or app/auth/demo (plain form posts, see the notes
// there); signing out stays on our own site, so it's a regular server action. It also
// forgets the demo's device pass (lib/device.ts).
export async function signOut() {
  const { error } = await neonAuth().signOut();
  if (error) console.error("Sign-out failed:", error.message);
  (await cookies()).delete(DEMO_DEVICE_COOKIE);
  redirect("/login");
}
