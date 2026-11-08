"use client";

import { useActionState, useEffect, useRef } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { useToday } from "@/components/useToday";
import { UNITS, unitsFor } from "@/lib/units";
import { logPrice, type LogPriceResult } from "@/features/prices/actions";
import { loggedPriceText } from "@/features/prices/components/LogPriceForm";
import { PriceWheel } from "@/features/prices/components/PriceWheel";
import { StoreWheel } from "@/features/prices/components/StoreWheel";
import type { StoreRow } from "@/features/prices/schema";
import type { ListEntry, QuickLog } from "../queries";

const box = "border-border bg-surface min-h-12 rounded-xl border px-3 text-[17px]";

// The quick price log that slides up when you check an item off in a store
// (docs/decisions/0032). The store wheel starts at the one you're at and the date is today;
// the price wheels and package size start at the last price you logged (here if possible),
// so an unchanged price is one tap: Save. It saves through the same action as the item page.
export function QuickLogSheet({
  entry,
  quickLog,
  store,
  stores,
  onClose,
  onSaved,
}: {
  entry: ListEntry;
  quickLog: QuickLog;
  store: StoreRow; // where you're shopping: the store wheel starts here
  stores: StoreRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const today = useToday();
  const [result, formAction, pending] = useActionState<LogPriceResult, FormData>(
    async (prev, form) => {
      const saved = await logPrice(prev, form);
      if (saved?.ok) onSaved(`${entry.name} at ${store.name}. ${loggedPriceText(saved.data)}`);
      return saved;
    },
    null,
  );

  // Open as a modal (focus moves in, the page behind is inert, Escape closes it).
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const dimension = UNITS[quickLog.compareUnit].dimension;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quick-log-title"
      onClose={onClose}
      className="bg-surface text-text mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/40"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="itemId" value={quickLog.itemId} />
        <input type="hidden" name="observedOn" value={today} />

        <div>
          <h2 id="quick-log-title" className="text-[20px] font-medium break-words">
            <FoodEmoji name={entry.name} custom={entry.emoji} photo={entry.photo} />
            {entry.name} at {store.name}
          </h2>
          <p className="text-muted text-[15px]">
            {quickLog.price === null
              ? "Your first price for this one. Today's date."
              : quickLog.fromHere
                ? "Starts at your last price here. Same price? Just tap Save."
                : "Starts at your latest price from another store."}
          </p>
        </div>

        <div className="flex gap-2">
          <div role="group" aria-label="Store" className="w-[42%] shrink-0">
            <StoreWheel name="storeId" stores={stores} currentId={store.id} />
          </div>
          <div role="group" aria-label="Price" className="min-w-0 flex-1">
            <PriceWheel name="price" initial={quickLog.price ?? 5} />
          </div>
        </div>

        <fieldset>
          <legend className="font-medium">Package size</legend>
          <div className="mt-2 flex gap-3">
            <input
              name="quantity"
              inputMode="decimal"
              required
              autoComplete="off"
              aria-label="Package size amount"
              placeholder="1"
              defaultValue={quickLog.quantity ?? ""}
              className={`${box} min-w-0 flex-1`}
            />
            <select
              name="unit"
              aria-label="Package size unit"
              defaultValue={quickLog.unit ?? quickLog.compareUnit}
              className={`${box} w-28 shrink-0`}
            >
              {unitsFor(dimension).map((unit) => (
                <option key={unit} value={unit}>
                  {UNITS[unit].label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <label className="border-border flex min-h-12 items-center gap-3 rounded-xl border px-3">
          <input type="checkbox" name="onSale" className="accent-accent size-5" />
          On sale
        </label>

        {result?.ok === false && (
          <p role="alert" className="font-medium">
            ⚠️ {result.error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="border-border min-h-12 flex-1 rounded-xl border font-medium"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={pending || !today}
            className="bg-accent text-on-accent min-h-12 flex-[2] rounded-xl font-medium disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save price"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
