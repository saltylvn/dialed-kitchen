"use client";

import { useActionState } from "react";
import { setItemEmoji, type SetItemEmojiResult } from "../actions";

const button = "border-border min-h-12 rounded-xl border px-4 font-medium disabled:opacity-60";

// Choose the emoji shown next to an item: type one from the iPhone emoji keyboard (😀 or 🌐
// key), or go back to the one worked out from the name. Checked again on the server.
export function ItemEmojiForm({
  itemId,
  custom,
  automatic,
}: {
  itemId: string;
  custom: string | null; // the household's choice, if any
  automatic: string | null; // what the name gives on its own
}) {
  const [result, formAction, pending] = useActionState<SetItemEmojiResult, FormData>(
    setItemEmoji,
    null,
  );
  const shown = custom ?? automatic;

  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        {shown ? (
          <>
            Showing <span className="text-[24px]">{shown}</span>{" "}
            <span className="text-muted">{custom ? "(your choice)" : "(from the name)"}</span>
          </>
        ) : (
          <span className="text-muted">No emoji yet: the name isn&apos;t one the app knows.</span>
        )}
      </p>

      <form action={formAction} className="flex gap-3">
        <input type="hidden" name="itemId" value={itemId} />
        <label htmlFor="item-emoji" className="sr-only">
          Emoji
        </label>
        <input
          key={custom ?? ""} // reset to the saved value after saving
          id="item-emoji"
          name="emoji"
          defaultValue={custom ?? ""}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          maxLength={16}
          placeholder="Tap, then 😀"
          aria-describedby="item-emoji-help"
          className="border-border bg-surface min-h-12 w-36 min-w-0 rounded-xl border px-3 text-center text-[24px] placeholder:text-[17px]"
        />
        <button
          type="submit"
          disabled={pending}
          className={`${button} bg-accent text-on-accent flex-1 border-transparent`}
        >
          {pending ? "Saving…" : "Save emoji"}
        </button>
      </form>
      <p id="item-emoji-help" className="text-muted text-[15px]">
        On iPhone, tap the box, then the 😀 key for the emoji keyboard.
      </p>

      {custom && (
        <form action={formAction}>
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="emoji" value="" />
          <button type="submit" disabled={pending} className={`${button} w-full`}>
            {automatic ? `Go back to ${automatic}` : "Remove emoji"}
          </button>
        </form>
      )}

      {result?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {result.error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="font-medium">
          ✓ Saved
        </p>
      )}
    </div>
  );
}
