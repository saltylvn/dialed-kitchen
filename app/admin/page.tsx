import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { declineWaitlistEntry, removeWaitlistEntry } from "@/features/access/actions";
import { ApproveButton } from "@/features/access/components/ApproveButton";
import { getAdminPage, isAdmin } from "@/features/access/queries";
import type { WaitlistEntry } from "@/features/access/schema";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Admin · Dialed Kitchen" };

const STATUS_LABEL: Record<WaitlistEntry["status"], string> = {
  waiting: "Waiting",
  invited: "Code sent",
  joined: "✓ Joined",
  declined: "Declined",
};

// The waitlist, for the admin only (docs/decisions/0043). Anyone else gets "not found", so
// the page doesn't even admit it exists; the database's RLS would show them nothing anyway.
export default async function AdminPage() {
  await requireUser();
  if (!(await isAdmin())) notFound();
  const { overview, entries } = await getAdminPage();
  const left = Math.max(0, overview.account_limit - overview.accounts - overview.open_invites);

  return (
    <main className="pt-screen mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <Link href="/settings" className="text-muted -ml-1 inline-flex min-h-12 items-center px-1">
        ‹ Settings
      </Link>
      <h1 className="font-display mt-1 text-[36px] leading-tight font-light italic">Waitlist</h1>

      <p className="mt-3">
        <span className="font-medium tabular-nums">
          {overview.accounts} of {overview.account_limit}
        </span>{" "}
        accounts used · {overview.open_invites} open{" "}
        {overview.open_invites === 1 ? "code" : "codes"} ·{" "}
        <span className="font-medium">{left} left</span>
      </p>

      {entries.length === 0 ? (
        <p className="text-muted mt-6">Nobody has asked to join yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-border bg-surface rounded-2xl border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium break-words">{e.name}</p>
                <p className="text-muted shrink-0 text-[14px]">{STATUS_LABEL[e.status]}</p>
              </div>
              <p className="text-muted break-all">{e.email}</p>
              {e.note && <p className="mt-2">“{e.note}”</p>}
              {e.status !== "joined" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.status !== "declined" && (
                    <ApproveButton id={e.id} email={e.email} again={e.status === "invited"} />
                  )}
                  {e.status === "waiting" && (
                    <form action={declineWaitlistEntry}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        className="border-border min-h-12 rounded-xl border px-4 font-medium"
                      >
                        Decline
                      </button>
                    </form>
                  )}
                  <form action={removeWaitlistEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${e.name}`}
                      className="border-border min-h-12 rounded-xl border px-4 font-medium"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
