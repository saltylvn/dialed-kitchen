import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/features/access/components/WaitlistForm";

export const metadata: Metadata = { title: "Join the waitlist · Dialed Kitchen" };

// Signed out: ask for an account (docs/decisions/0043). New accounts are invite-only.
export default function WaitlistPage() {
  return (
    <main className="pt-screen mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <Link href="/login" className="text-muted -ml-1 inline-flex min-h-12 items-center px-1">
        ‹ Sign in
      </Link>
      <h1 className="font-display mt-1 text-[36px] leading-tight font-light italic">
        Join the waitlist
      </h1>
      <p className="text-muted mt-2 mb-6">
        Dialed Kitchen is a personal project with a few places. Ask to join, and if a place opens
        you&apos;ll get an invite code.
      </p>
      <WaitlistForm />
    </main>
  );
}
