"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { GENERIC_ERROR, userMessage, type ActionResult } from "@/lib/actionResult";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { createSignupCode, hashSignupCode, normalizeSignupCode } from "@/lib/signupCodes";
import { isAdmin } from "./queries";
import { ACCESS_ERRORS, inviteCodeFormSchema, waitlistFormSchema } from "./schema";

// Invite-only sign-up (docs/decisions/0043). The database functions repeat every check
// (admin only, one code per email, the 25-account limit) and are the final word.

export type WaitlistResult = ActionResult | null;

// Signed out: ask to join. The reply is the same whether or not the email was already on
// the list, so the form can't be used to find out who has asked.
export async function joinWaitlist(
  _prev: WaitlistResult,
  formData: FormData,
): Promise<WaitlistResult> {
  const parsed = waitlistFormSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", {
    email: parsed.data.email,
    name: parsed.data.name,
    note: parsed.data.note ?? undefined,
  });
  if (error) {
    console.error("join_waitlist failed:", error.message);
    return { ok: false, error: userMessage(error, ACCESS_ERRORS) };
  }
  return { ok: true, data: undefined };
}

export type InviteCodeResult = ActionResult<{ email: string }> | null;

// Signed out: enter the code from the admin. Marks it redeemed, so the next Google sign-in
// with the invited email creates the account. Says which email it's for.
export async function redeemInviteCode(
  _prev: InviteCodeResult,
  formData: FormData,
): Promise<InviteCodeResult> {
  const parsed = inviteCodeFormSchema.safeParse({ code: formData.get("code") ?? "" });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your invite code" };
  }
  const invalid = {
    ok: false as const,
    error: "That code didn't work. Check it, or ask for a new one: codes last 7 days.",
  };
  if (!normalizeSignupCode(parsed.data.code)) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_signup_invite", {
    code_hash: hashSignupCode(parsed.data.code),
  });
  if (error) {
    console.error("redeem_signup_invite failed:", error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  const email = z.string().nullable().parse(data);
  return email ? { ok: true, data: { email } } : invalid;
}

// ─── Admin only ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  await requireUser();
  if (!(await isAdmin())) notFound();
}

export type ApproveResult = ActionResult<{ code: string; email: string }> | null;

// Approve someone: a new code, shown to the admin once (only its hash is stored). Approving
// again replaces the old code.
export async function approveWaitlistEntry(
  _prev: ApproveResult,
  formData: FormData,
): Promise<ApproveResult> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  const email = z.string().safeParse(formData.get("email"));
  if (!id.success || !email.success) return { ok: false, error: GENERIC_ERROR };

  const code = createSignupCode();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_signup_invite", {
    waitlist_id: id.data,
    code_hash: hashSignupCode(code),
  });
  if (error) {
    console.error("create_signup_invite failed:", error.message);
    return { ok: false, error: userMessage(error, ACCESS_ERRORS) };
  }
  // No revalidatePath: refreshing would replace this form before the code is shown, and the
  // code can't be shown again. The list updates on the next visit.
  return { ok: true, data: { code, email: email.data } };
}

export async function declineWaitlistEntry(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist")
    .update({ status: "declined" })
    .eq("id", id.data);
  if (error) console.error("decline failed:", error.message);
  revalidatePath("/admin");
}

export async function removeWaitlistEntry(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").delete().eq("id", id.data);
  if (error) console.error("remove failed:", error.message);
  revalidatePath("/admin");
}
