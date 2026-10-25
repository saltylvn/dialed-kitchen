import type { Metadata } from "next";
import { Wordmark } from "@/components/ui/Wordmark";
import { signInAsDemo } from "@/features/auth/actions";
import { demoPassword } from "@/lib/server/demo";

export const metadata: Metadata = { title: "Sign in · Dialed Kitchen" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-[max(env(safe-area-inset-top),4.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <h1>
        <Wordmark />
      </h1>

      <div aria-hidden className="bg-accent mt-9 mb-8 h-px w-7" />

      <p className="font-display text-center text-[36px] leading-tight font-light italic">
        Plan it, price it,
        <br />
        cook it.
      </p>

      {/* A plain HTML form posting to app/auth/google: the browser follows the sign-in
          redirects itself, and it works even before JavaScript has loaded. */}
      <form action="/auth/google" method="post" className="mt-auto w-full pt-10">
        {error === "full" ? (
          <p role="alert" className="mb-4 text-center font-medium">
            Dialed Kitchen is a personal project and isn&apos;t taking new accounts. Existing
            accounts can still sign in.
          </p>
        ) : (
          error && (
            <p role="alert" className="mb-4 text-center font-medium">
              ⚠️ Sign-in didn&apos;t work. Please try again.
            </p>
          )
        )}
        <button
          type="submit"
          className="bg-accent text-on-accent min-h-12 w-full rounded-xl text-[17px] font-medium tracking-wide"
        >
          Continue with Google
        </button>
      </form>

      {demoPassword() && (
        <form action={signInAsDemo} className="mt-3 w-full">
          <button
            type="submit"
            className="border-border bg-surface min-h-12 w-full rounded-xl border text-[17px] font-medium"
          >
            Try the demo
          </button>
          <p className="text-muted mt-2 text-center text-[14px]">
            For hiring teams: a shared demo kitchen with sample data, reset daily.
          </p>
        </form>
      )}
    </main>
  );
}
