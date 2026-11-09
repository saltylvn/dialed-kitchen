"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { useToday } from "@/components/useToday";
import { UNITS, unitsFor } from "@/lib/units";
import { logPrice, type LogPriceResult } from "@/features/prices/actions";
import { loggedPriceText } from "@/features/prices/components/LogPriceForm";
import { PriceWheel } from "@/features/prices/components/PriceWheel";
import { StoreWheel } from "@/features/prices/components/StoreWheel";
import type { StoreRow } from "@/features/prices/schema";
import type { ListEntry } from "../queries";

const box = "border-border bg-surface min-h-12 rounded-xl border px-3 text-[17px]";
const plain = "border-border min-h-12 flex-1 rounded-xl border px-3 font-medium";

// What the Log button on a grocery row opens (docs/decisions/0034): a bottom sheet to log
// today's price, with the store and price wheels starting at your last price (Trader Joe's
// first), so an unchanged price is one tap: Save. Below it, the row's other actions: it's
// already In stock, or take it off the list. It saves through the same action as the item
// page, so the checks and the "New best price!" message are the same.
export function ItemSheet({
  entry,
  stores,
  onClose,
  onSaved,
  onInStock,
  onRemove,
}: {
  entry: ListEntry;
  stores: StoreRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onInStock: () => void;
  onRemove: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const today = useToday();
  const quickLog = entry.quickLog;
  const [result, formAction, pending] = useActionState<LogPriceResult, FormData>(
    async (prev, form) => {
      const saved = await logPrice(prev, form);
      if (saved?.ok) onSaved(`${entry.name}. ${loggedPriceText(saved.data)}`);
      return saved;
    },
    null,
  );

  // Open as a modal (focus moves in, the page behind is inert, Escape closes it).
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="item-sheet-title"
      onClose={onClose}
      className="bg-surface text-text mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/40"
    >
      <h2 id="item-sheet-title" className="text-[20px] font-medium break-words">
        <FoodEmoji name={entry.name} custom={entry.emoji} photo={entry.photo} />
        {entry.name}
      </h2>

      {quickLog ? (
        <form action={formAction} className="mt-3 space-y-4">
          <input type="hidden" name="itemId" value={quickLog.itemId} />
          <input type="hidden" name="observedOn" value={today} />
          <p className="text-muted text-[15px]">
            {quickLog.from
              ? `Starts at your last ${quickLog.from} price. Same price? Just tap Save.`
              : "Your first price for this one. Today's date."}
          </p>

          <div className="flex gap-2">
            <div role="group" aria-label="Store" className="w-[42%] shrink-0">
              <StoreWheel name="storeId" stores={stores} />
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
                {unitsFor(UNITS[quickLog.compareUnit].dimension).map((unit) => (
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
            <button type="button" onClick={() => dialog.current?.close()} className={plain}>
              Close
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
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-[17px]">
            Not in your price book yet. Add it to log its prices and compare your stores.
          </p>
          <Link
            href={`/grocery/items/new?name=${encodeURIComponent(entry.name)}`}
            className="bg-accent text-on-accent flex min-h-12 items-center justify-center rounded-xl font-medium"
          >
            Add to price book
          </Link>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className={`${plain} w-full`}
          >
            Close
          </button>
        </div>
      )}

      <div className="border-border mt-5 flex gap-3 border-t pt-4">
        {!entry.checked && (
          <button type="button" onClick={onInStock} className={`${plain} text-[15px]`}>
            Mark In stock
          </button>
        )}
        <button type="button" onClick={onRemove} className={`${plain} text-[15px]`}>
          Remove from list
        </button>
      </div>
    </dialog>
  );
}
