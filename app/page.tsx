import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { getMyHousehold } from "@/features/partner/queries";
import { requireUser } from "@/lib/server/auth";

// Signed-in home for now: who you are, who you share with, and what's coming.
// The tab layout (Plan, Recipes, List, Prices) replaces this in the next step.
const COMING = [
  "Grocery lists with a shopping mode",
  "Best price per item, across every store",
  "Recipes from websites, cookbooks and magazines",
  "Weekly meal planning that builds your list",
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const [user, household, { joined }] = await Promise.all([
    requireUser(),
    getMyHousehold(),
    searchParams,
  ]);
  const partner = household.members.find((m) => !m.is_me);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="relative flex min-h-12 items-center justify-center">
        <h1>
          <Wordmark size="sm" />
        </h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-muted absolute right-0 flex size-12 items-center justify-center text-2xl"
        >
          <span aria-hidden>⚙︎</span>
        </Link>
      </header>

      {joined && partner && (
        <p
          role="status"
          className="border-border bg-surface mt-4 rounded-xl border p-3 text-center"
        >
          🎉 You now share your kitchen with {partner.email}.
        </p>
      )}

      <p className="text-muted mt-6 text-center">
        {partner ? `Sharing with ${partner.email}` : `Signed in as ${user.email}`}
      </p>

      <section className="border-border bg-surface mt-6 rounded-2xl border p-4">
        <h2 className="text-muted text-[12px] tracking-[0.2em] uppercase">Coming soon</h2>
        <ul className="mt-3 space-y-2">
          {COMING.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-success">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
