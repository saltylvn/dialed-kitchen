"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userMessage, type ActionResult } from "@/lib/actionResult";
import {
  createInviteToken,
  hashInviteToken,
  inviteLink,
  isWellFormedInviteToken,
} from "@/lib/invites";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { HOME_TAB } from "@/lib/tabs";
import { inviteFormSchema, PARTNER_ERRORS } from "./schema";

// Partner actions. Each one checks sign-in and input here; the database functions check
// everything again (membership, limits, the invited email) and are the final word.

export type InviteResult = ActionResult<{ link: string; email: string }> | null;

// Creates an invite and returns its link. The link is shown once: only its hash is stored,
// so it can't be looked up again (a new invite replaces it).
export async function createInvite(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  await requireUser();
  const parsed = inviteFormSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the email" };

  const token = createInviteToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household_invite", {
    invited_email: parsed.data.email,
    token_hash: hashInviteToken(token),
  });
  if (error) {
    console.error("create_household_invite failed:", error.message);
    return { ok: false, error: userMessage(error, PARTNER_ERRORS) };
  }

  // Server actions only run for requests from this site (Next.js checks Origin), so the
  // origin here is our own.
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  // Deliberately no revalidatePath here: refreshing the page would swap the form for the
  // "Invite sent" view and lose the link before it's shown, and the link can't be fetched
  // again (only its hash is stored). The page shows "Invite sent" on the next visit.
  return { ok: true, data: { link: inviteLink(origin, token), email: parsed.data.email } };
}

export async function cancelInvite(formData: FormData): Promise<void> {
  await requireUser();
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_household_invite", { invite_id: inviteId.data });
  if (error) console.error("revoke_household_invite failed:", error.message);
  revalidatePath("/settings");
}

export async function endPartnership(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_partnership");
  if (error) console.error("end_partnership failed:", error.message);
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function acceptInvite(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const token = String(formData.get("token") ?? "");
  if (!isWellFormedInviteToken(token))
    return { ok: false, error: "This invite is no longer valid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_household_invite", {
    token_hash: hashInviteToken(token),
  });
  if (error) {
    console.error("accept_household_invite failed:", error.message);
    return { ok: false, error: userMessage(error, PARTNER_ERRORS) };
  }
  revalidatePath("/", "layout");
  redirect(`${HOME_TAB.href}?joined=1`);
}
