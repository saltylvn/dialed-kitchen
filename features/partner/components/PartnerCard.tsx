import { daysUntil } from "@/lib/invites";
import { cancelInvite, endPartnership } from "../actions";
import type { Household } from "../schema";
import { InviteForm } from "./InviteForm";

// The Partner section of Settings: invite your spouse, see your partner, or end it.
// Sharing is only ever between two married partners (docs/decisions/0009).
export function PartnerCard({ household }: { household: Household }) {
  const partner = household.members.find((m) => !m.is_me);
  const invite = household.open_invite;

  return (
    <section
      aria-labelledby="partner-heading"
      className="border-border bg-surface rounded-2xl border p-4"
    >
      <h2 id="partner-heading" className="text-muted text-[12px] tracking-[0.2em] uppercase">
        Partner
      </h2>

      {partner ? (
        <>
          <p className="mt-3 text-[17px]">
            You share your kitchen with <span className="font-medium">{partner.email}</span>.
          </p>
          <p className="text-muted mt-1 text-[15px]">
            Plans, lists, prices and recipes stay in sync for both of you.
          </p>
          <details className="mt-4">
            <summary className="text-muted min-h-12 cursor-pointer content-center text-[15px]">
              End partnership…
            </summary>
            <p className="mt-2 text-[15px]">
              {household.is_creator
                ? `Everything stays with you. ${partner.email} will start with an empty kitchen.`
                : `Everything stays with ${partner.email}. You'll start with an empty kitchen.`}
            </p>
            <form action={endPartnership} className="mt-3">
              <button
                type="submit"
                className="border-border min-h-12 w-full rounded-xl border font-medium"
              >
                End partnership
              </button>
            </form>
          </details>
        </>
      ) : invite && !invite.expired ? (
        <>
          <p className="mt-3 text-[17px]">
            Invite sent to <span className="font-medium">{invite.invited_email}</span>
          </p>
          <p className="text-muted mt-1 text-[15px]">
            Expires in {daysUntil(invite.expires_at)}{" "}
            {daysUntil(invite.expires_at) === 1 ? "day" : "days"}. Lost the link? Create a new one
            below; it replaces this invite.
          </p>
          <form action={cancelInvite} className="mt-3">
            <input type="hidden" name="inviteId" value={invite.id} />
            <button
              type="submit"
              className="border-border min-h-12 w-full rounded-xl border font-medium"
            >
              Cancel invite
            </button>
          </form>
          <InviteForm defaultEmail={invite.invited_email} />
        </>
      ) : (
        <>
          <p className="mt-3 text-[17px]">Share your kitchen with your spouse.</p>
          <p className="text-muted mt-1 text-[15px]">
            Plans, lists, prices and recipes stay in sync for both of you. Invite only.
          </p>
          <InviteForm />
        </>
      )}
    </section>
  );
}
