import type { Metadata } from "next";
import { signInWithGoogle } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Sign in · Dialed Kitchen" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <h1 className="text-4xl font-semibold">Dialed Kitchen</h1>
      <p className="text-muted mt-2 text-lg">Plan it, price it, cook it.</p>

      {/* A plain form: it works even before JavaScript has loaded. */}
      <form action={signInWithGoogle} className="mt-10">
        <button
          type="submit"
          className="bg-accent font-heading text-on-accent min-h-12 w-full rounded-xl text-lg font-semibold"
        >
          Continue with Google
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 font-semibold">
          ⚠️ Sign-in didn&apos;t work. Please try again.
        </p>
      )}
    </main>
  );
}
