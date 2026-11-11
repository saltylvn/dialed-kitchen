"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinWaitlist, type WaitlistResult } from "../actions";

// Ask to join (signed out). After sending, the form is replaced by a short confirmation.
export function WaitlistForm() {
  const [result, formAction, pending] = useActionState<WaitlistResult, FormData>(
    joinWaitlist,
    null,
  );

  if (result?.ok) {
    return (
      <div role="status" className="border-border bg-surface rounded-2xl border p-4">
        <p className="font-medium">✓ You&apos;re on the waitlist.</p>
        <p className="text-muted mt-1">
          If a place opens up, you&apos;ll get an invite code by email. Enter it on the sign-in
          page, then continue with Google using the same email.
        </p>
        <Link href="/login" className="mt-3 inline-flex min-h-12 items-center underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const field = "border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]";
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="wl-name" className="font-medium">
          Name
        </label>
        <input
          id="wl-name"
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="wl-email" className="font-medium">
          Email
        </label>
        <input
          id="wl-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className={field}
        />
        <p className="text-muted mt-1 text-[14px]">The Google account you&apos;ll sign in with.</p>
      </div>
      <div>
        <label htmlFor="wl-note" className="font-medium">
          Note <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="wl-note"
          name="note"
          maxLength={300}
          rows={3}
          className="border-border bg-surface mt-2 w-full rounded-xl border px-3 py-2 text-[17px]"
        />
      </div>
      {result?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {result.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent min-h-12 w-full rounded-xl font-medium disabled:opacity-60"
      >
        {pending ? "Sending…" : "Join the waitlist"}
      </button>
    </form>
  );
}
