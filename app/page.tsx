import { Wordmark } from "@/components/ui/Wordmark";
import { signOut } from "@/features/auth/actions";
import { requireUser } from "@/lib/server/auth";

// Signed-in home for now: shows who you are and what's coming.
// The tab layout (Plan, Recipes, List, Prices) replaces this in the next step.
const COMING = [
  "Grocery lists with a shopping mode",
  "Best price per item, across every store",
  "Recipes from websites, cookbooks and magazines",
  "Weekly meal planning that builds your list",
];

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <h1 className="flex justify-center">
        <Wordmark size="sm" />
      </h1>
      <p className="text-muted mt-6 text-center">Signed in as {user.email}</p>

      <section className="border-border bg-surface mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <ul className="mt-2 space-y-2">
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

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="border-border bg-surface min-h-12 w-full rounded-xl border font-semibold"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
