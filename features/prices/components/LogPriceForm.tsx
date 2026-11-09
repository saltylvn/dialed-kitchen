"use client";

import { useActionState } from "react";
import { useToday } from "@/components/useToday";
import { choiceLabel, choicesFor, DIMENSIONS, UNITS, type Dimension, type Unit } from "@/lib/units";
import { logPrice, type LogPriceResult } from "../actions";
import type { StoreRow } from "../schema";
import { PriceWheel } from "./PriceWheel";
import { StoreWheel } from "./StoreWheel";

const box = "border-border bg-surface mt-2 min-h-12 rounded-xl border px-3 text-[17px]";
const GROUPS: Dimension[] = ["weight", "volume", "count"];

// Log a price for one item: store and price (swipe wheels), package size and date.
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
  const itemDimension = UNITS[compareUnit].dimension;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />

      {result?.ok && <ResultMessage result={result.data} />}

      {/* Store and price side by side, as swipe wheels: the store starts at Trader Joe's,
          the price at the item's last price (docs/decisions/0032, 0035). */}
      <div className="flex gap-2">
        <div className="w-[42%] shrink-0">
          <p id="store-label" className="font-medium">
            Store
          </p>
          <div role="group" aria-labelledby="store-label" className="mt-2">
            <StoreWheel name="storeId" stores={stores} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p id="price-label" className="font-medium">
            Price
          </p>
          <div role="group" aria-labelledby="price-label" className="mt-2">
            <PriceWheel name="price" initial={initialPrice} />
          </div>
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
            {/* Grouped like the item's "Compare prices" menu. Only the item's own kind of
                measure can be picked: a price per lb can't be compared with one per each. */}
            {GROUPS.map((dimension) => (
              <optgroup key={dimension} label={DIMENSIONS[dimension].label}>
                {choicesFor(dimension).map((choice) => (
                  <option key={choice} value={choice} disabled={dimension !== itemDimension}>
                    {choiceLabel(choice)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </fieldset>

      <div>
        <div>
          <label htmlFor="price-date" className="font-medium">
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
            className="border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]"
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
