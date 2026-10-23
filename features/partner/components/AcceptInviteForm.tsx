"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actionResult";
import { acceptInvite } from "../actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(
    acceptInvite,
    null,
  );

  return (
    <form action={formAction} className="mt-auto w-full pt-10">
      <input type="hidden" name="token" value={token} />
      {result?.ok === false && (
        <p role="alert" className="mb-4 text-center font-medium">
          ⚠️ {result.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent min-h-12 w-full rounded-xl text-[17px] font-medium disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join kitchen"}
      </button>
    </form>
  );
}
