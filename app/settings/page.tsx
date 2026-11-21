import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import { GoalForm } from "@/features/food-log/components/GoalForm";
import { getMyGoal } from "@/features/food-log/queries";
import { BudgetForm } from "@/features/plan/components/BudgetForm";
import { getWeeklyBudget } from "@/features/plan/queries";
import { PartnerCard } from "@/features/partner/components/PartnerCard";
import { getMyHousehold } from "@/features/partner/queries";
import { isAdmin } from "@/features/access/queries";
import { isDemoEmail } from "@/lib/demo";
import { requireUser } from "@/lib/server/auth";
import { tabFromParam } from "@/lib/tabs";

export const metadata: Metadata = { title: "Settings · Dialed Kitchen" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const [user, household, { from }, admin, goal, budget] = await Promise.all([
    requireUser(),
    getMyHousehold(),
    searchParams,
    isAdmin(),
    getMyGoal(),
    getWeeklyBudget(),
  ]);
  const backTo = tabFromParam(from); // the tab Settings was opened from

  return (
    <main className="pt-screen mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <Link href={backTo.href} className="text-muted -ml-1 inline-flex min-h-12 items-center px-1">
        ‹ {backTo.label}
      </Link>
      <h1 className="heading-1 mt-1">Settings</h1>

      <div className="mt-6 space-y-4">
        <GoalForm goal={goal} />
        <BudgetForm budget={budget} />

        {isDemoEmail(user.email) ? (
          <section
            aria-labelledby="partner-heading"
            className="border-border bg-surface rounded-xl border p-4"
          >
            <h2 id="partner-heading" className="label">
              Partner
            </h2>
            <p className="mt-3">
              Partner sharing is turned off in the demo. In a real account, a couple shares one
              kitchen through an invite-only link.
            </p>
          </section>
        ) : (
          <PartnerCard household={household} />
        )}

        {admin && (
          <Link
            href="/admin"
            className="border-border bg-surface flex min-h-12 items-center justify-between rounded-xl border p-4 font-medium"
          >
            Waitlist and invite codes <span aria-hidden>›</span>
          </Link>
        )}

        <section
          aria-labelledby="account-heading"
          className="border-border bg-surface rounded-xl border p-4"
        >
          <h2 id="account-heading" className="label">
            Account
          </h2>
          <p className="mt-3 text-[17px] break-all">{user.email}</p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="border-border min-h-12 w-full rounded-lg border font-medium"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
