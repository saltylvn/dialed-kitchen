"use client";

import { useState, useTransition } from "react";
import { copyPlanWeek } from "../actions";

// "Repeat last week": copies last week's meals into this one, day for day, skipping anything
// already planned, so it's safe to tap twice (decision 0053).
export function RepeatWeek({ lastWeek, week }: { lastWeek: string; week: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await copyPlanWeek(lastWeek, week);
            if (!result.ok) setMessage({ error: true, text: result.error });
            else
              setMessage({
                error: false,
                text:
                  result.data.added === 0
                    ? "Nothing new to copy from last week."
                    : `✓ Copied ${result.data.added} ${result.data.added === 1 ? "meal" : "meals"} from last week.`,
              });
          })
        }
        className="btn btn-secondary w-full"
      >
        {pending ? "Copying…" : "Repeat last week"}
      </button>
      {message && (
        <p role={message.error ? "alert" : "status"} className="mt-2 text-[15px]">
          {message.error ? `⚠️ ${message.text}` : message.text}
        </p>
      )}
    </div>
  );
}
