"use client";

import { useActionState } from "react";
import { redeemInviteCode, type InviteCodeResult } from "../actions";

// "Have an invite code?" on the sign-in page. A right code is marked redeemed (it's used up
// when the account is created) and the page says which Google account to continue with.
export function InviteCodeForm() {
  const [result, formAction, pending] = useActionState<InviteCodeResult, FormData>(
    redeemInviteCode,
    null,
  );

  if (result?.ok) {
    return (
      <p role="status" className="text-success-text text-center font-medium">
        ✓ Code accepted. Now tap Continue with Google and choose{" "}
        <span className="break-all">{result.data.email}</span>.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <label htmlFor="invite-code" className="font-medium">
        Have an invite code?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="invite-code"
          name="code"
          required
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Invite code"
          className="border-border bg-surface min-h-12 min-w-0 flex-1 rounded-xl border px-3 text-[17px] tracking-wider"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-border bg-surface min-h-12 shrink-0 rounded-xl border px-4 font-medium disabled:opacity-60"
        >
          {pending ? "Checking…" : "Use code"}
        </button>
      </div>
      {result?.ok === false && (
        <p role="alert" className="mt-2 font-medium">
          ⚠️ {result.error}
        </p>
      )}
    </form>
  );
}
