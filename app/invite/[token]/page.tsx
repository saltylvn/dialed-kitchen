import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { AcceptInviteForm } from "@/features/partner/components/AcceptInviteForm";
import { getMyHousehold, getInvitePreview } from "@/features/partner/queries";
import type { InvitePreview } from "@/features/partner/schema";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Join a kitchen · Dialed Kitchen",
  referrer: "no-referrer", // the token is in this page's URL; never send it anywhere
};

const MESSAGES: Record<Exclude<InvitePreview["status"], "valid">, string> = {
  not_found: "This invite link isn't valid. Ask your spouse to send a new one.",
  wrong_account:
    "This invite is for a different Google account. Sign out and sign in with the email it was sent to.",
  used: "This invite has already been used.",
  revoked: "This invite was cancelled. Ask your spouse to send a new one.",
  expired: "This invite has expired. Ask your spouse to send a new one.",
  already_member: "You're already sharing this kitchen.",
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  await requireUser();
  const { token } = await params;
  const [preview, household] = await Promise.all([getInvitePreview(token), getMyHousehold()]);
  const hasPartner = household.members.length === 2;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-[max(env(safe-area-inset-top),4.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <Wordmark />
      <div aria-hidden className="bg-accent mt-9 mb-8 h-px w-7" />

      {preview.status === "valid" && !hasPartner ? (
        <>
          <h1 className="font-display text-center text-[34px] leading-tight font-light italic">
            Share a kitchen
          </h1>
          <p className="mt-4 text-center text-[17px]">
            <span className="font-medium">{preview.inviter_email}</span> invited you to share plans,
            lists, prices and recipes.
          </p>
          <p className="text-muted mt-2 text-center text-[15px]">
            Anything you&apos;ve added on your own stays private and isn&apos;t merged.
          </p>
          <AcceptInviteForm token={token} />
        </>
      ) : (
        <>
          <h1 className="font-display text-center text-[34px] leading-tight font-light italic">
            Invite
          </h1>
          <p role="status" className="mt-4 text-center text-[17px]">
            {preview.status === "valid"
              ? "You already share your kitchen with a partner. End that partnership in Settings before joining another."
              : MESSAGES[preview.status]}
          </p>
          <Link
            href="/"
            className="border-border mt-auto flex min-h-12 w-full items-center justify-center rounded-xl border font-medium"
          >
            Go to your kitchen
          </Link>
        </>
      )}
    </main>
  );
}
