"use client";

import { useActionState, useState } from "react";
import { approveWaitlistEntry, type ApproveResult } from "../actions";

// Approve one person: makes their invite code and shows it once, with a copy button and a
// ready-to-send message. Only the code's hash is stored, so it can't be shown again (approve
// again for a new one, which cancels the old).
export function ApproveButton({ id, email, again }: { id: string; email: string; again: boolean }) {
  const [result, formAction, pending] = useActionState<ApproveResult, FormData>(
    approveWaitlistEntry,
    null,
  );
  const [copied, setCopied] = useState(false);

  if (result?.ok) {
    const message =
      `You're invited to Dialed Kitchen! Your code: ${result.data.code}\n` +
      `Open https://dialed-kitchen.vercel.app, enter the code under "Have an invite code?", ` +
      `then Continue with Google as ${result.data.email}. The code works once, for 7 days.`;
    return (
      <div role="status" className="border-border mt-3 rounded-xl border p-3">
        <p className="text-muted text-[14px]">Invite code (shown once):</p>
        <p className="mt-1 font-medium tracking-wider break-all select-all">{result.data.code}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="bg-accent text-on-accent mt-3 min-h-12 w-full rounded-xl font-medium"
        >
          {copied ? "✓ Copied message" : "Copy invite message"}
        </button>
        <a
          href={`mailto:${encodeURIComponent(result.data.email)}?subject=${encodeURIComponent(
            "Your Dialed Kitchen invite",
          )}&body=${encodeURIComponent(message)}`}
          className="mt-2 inline-flex min-h-12 items-center underline"
        >
          Email it
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent min-h-12 w-full rounded-xl px-3 font-medium disabled:opacity-60"
      >
        {pending ? "Approving…" : again ? "New code" : "Approve"}
      </button>
      {result?.ok === false && (
        <p role="alert" className="mt-2 font-medium">
          ⚠️ {result.error}
        </p>
      )}
    </form>
  );
}
