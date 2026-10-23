import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import { PartnerCard } from "@/features/partner/components/PartnerCard";
import { getMyHousehold } from "@/features/partner/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Settings · Dialed Kitchen" };

export default async function SettingsPage() {
  const [user, household] = await Promise.all([requireUser(), getMyHousehold()]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <Link href="/" className="text-muted -ml-1 inline-flex min-h-12 items-center px-1">
        ‹ Home
      </Link>
      <h1 className="font-display mt-1 text-[36px] leading-tight font-light italic">Settings</h1>

      <div className="mt-6 space-y-4">
        <PartnerCard household={household} />

        <section
          aria-labelledby="account-heading"
          className="border-border bg-surface rounded-2xl border p-4"
        >
          <h2 id="account-heading" className="text-muted text-[12px] tracking-[0.2em] uppercase">
            Account
          </h2>
          <p className="mt-3 text-[17px] break-all">{user.email}</p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="border-border min-h-12 w-full rounded-xl border font-medium"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
