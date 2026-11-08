"use client";

import { useActionState } from "react";
import { useToday } from "@/components/useToday";
import { UNITS, unitsFor, type Unit } from "@/lib/units";
import { logPrice, type LogPriceResult } from "../actions";
import type { StoreRow } from "../schema";
import { PriceWheel } from "./PriceWheel";
import { StoreWheel } from "./StoreWheel";

const box = "border-border bg-surface mt-2 min-h-12 rounded-xl border px-3 text-[17px]";

// Log a price for one item: store and price (swipe wheels), package size, sale, date.
// After saving, says how it compares to the best price found before it.
export function LogPriceForm({
  itemId,
  compareUnit,
  stores,
  initialPrice,
}: {
  itemId: string;
  compareUnit: Unit;
  stores: StoreRow[];
  initialPrice: number; // where the price wheels start: the item's latest price
}) {
  const [result, formAction, pending] = useActionState<LogPriceResult, FormData>(logPrice, null);
  const today = useToday(); // the phone's own date; "" during the server render

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />

      {result?.ok && <ResultMessage result={result.data} />}

      <div>
        <p id="store-label" className="font-medium">
          Store
        </p>
        {/* A swipe wheel like the price: starts at Trader Joe's (docs/decisions/0032). */}
        <div role="group" aria-labelledby="store-label" className="mt-2">
          <StoreWheel name="storeId" stores={stores} />
        </div>
      </div>

      <div>
        <p id="price-label" className="font-medium">
          Price
        </p>
        <div role="group" aria-labelledby="price-label" className="mt-2">
          <PriceWheel name="price" initial={initialPrice} />
        </div>
      </div>

      <fieldset>
        <legend className="font-medium">Package size</legend>
        <div className="flex gap-3">
          <input
            name="quantity"
            inputMode="decimal"
            required
            autoComplete="off"
            aria-label="Package size amount"
            placeholder="3"
            className={`${box} min-w-0 flex-1`}
          />
          <select
            name="unit"
            aria-label="Package size unit"
            defaultValue={compareUnit}
            className={`${box} w-28 shrink-0`}
          >
            {unitsFor(UNITS[compareUnit].dimension).map((unit) => (
              <option key={unit} value={unit}>
                {UNITS[unit].label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex gap-3">
        <label className="border-border bg-surface flex min-h-12 flex-1 items-center gap-3 rounded-xl border px-3">
          <input type="checkbox" name="onSale" className="accent-accent size-5" />
          On sale
        </label>
        <div className="flex-1">
          <label htmlFor="price-date" className="sr-only">
            Date
          </label>
          <input
            key={today} // re-render with today's date once it's known
            id="price-date"
            name="observedOn"
            type="date"
            required
            defaultValue={today}
            max={today || undefined}
            className="border-border bg-surface min-h-12 w-full rounded-xl border px-3 text-[17px]"
          />
        </div>
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
        {pending ? "Saving…" : "Save price"}
      </button>
    </form>
  );
}

function ResultMessage({ result }: { result: LoggedPrice }) {
  const text = loggedPriceText(result);
  return (
    <p
      role="status"
      className={`border-border bg-surface rounded-xl border p-3 font-medium ${
        result.comparison.kind === "new_best" ? "text-success-text" : ""
      }`}
    >
      {text}
    </p>
  );
}

export type LoggedPrice = NonNullable<Extract<LogPriceResult, { ok: true }>>["data"];

// How a just-saved price compares to the best one before it (also used by the list's quick
// log, features/list/components/QuickLogSheet).
export function loggedPriceText({ comparison, unitPrice, bestBefore }: LoggedPrice): string {
  switch (comparison.kind) {
    case "first":
      return `✓ Saved. Your first price for this item: ${unitPrice}.`;
    case "new_best":
      return `🎉 New best price! ${unitPrice}, ${comparison.percentBelow}% below your previous best (${bestBefore}).`;
    case "matches_best":
      return `✓ Saved. That ties your best price: ${unitPrice}.`;
    case "above_best":
      return `✓ Saved: ${unitPrice}, ${comparison.percentAbove}% more than your best (${bestBefore}).`;
  }
}
