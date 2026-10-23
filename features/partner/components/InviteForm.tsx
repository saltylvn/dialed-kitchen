"use client";

import { useActionState } from "react";
import { createInvite, type InviteResult } from "../actions";
import { ShareLink } from "./ShareLink";

export function InviteForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [result, formAction, pending] = useActionState<InviteResult, FormData>(createInvite, null);

  if (result?.ok) return <ShareLink link={result.data.link} email={result.data.email} />;

  return (
    <form action={formAction} className="mt-4">
      <label htmlFor="partner-email" className="font-medium">
        Your spouse&apos;s Google email
      </label>
      <input
        id="partner-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={defaultEmail}
        placeholder="name@gmail.com"
        aria-describedby={result?.ok === false ? "invite-error" : undefined}
        className="border-border bg-bg mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]"
      />
      {result?.ok === false && (
        <p id="invite-error" role="alert" className="mt-2 font-medium">
          ⚠️ {result.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent mt-3 min-h-12 w-full rounded-xl font-medium disabled:opacity-60"
      >
        {pending ? "Creating link…" : "Create invite link"}
      </button>
    </form>
  );
}
