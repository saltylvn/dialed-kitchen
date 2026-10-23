"use client";

import { useActionState } from "react";
import { DIMENSIONS, UNITS, unitsFor, type Dimension } from "@/lib/units";
import { addToList, type AddToListResult } from "../actions";

const box = "border-border bg-surface min-h-12 rounded-xl border px-3 text-[17px]";
const GROUPS: Dimension[] = ["weight", "volume", "count"];

// Add to the list: what, and optionally how much. Suggests items from the price book;
// matching ones are linked so the list can show their prices.
export function AddToListForm({ itemNames }: { itemNames: string[] }) {
  const [result, formAction, pending] = useActionState<AddToListResult, FormData>(addToList, null);

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="list-name" className="sr-only">
        Add to the list
      </label>
      <input
        id="list-name"
        name="name"
        list="price-book-items"
        required
        maxLength={80}
        autoComplete="off"
        placeholder="Add to the list…"
        className={`${box} w-full`}
      />
      <datalist id="price-book-items">
        {itemNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <input
          name="quantity"
          inputMode="decimal"
          autoComplete="off"
          aria-label="Amount (optional)"
          placeholder="Amount"
          className={`${box} min-w-0 flex-1`}
        />
        <select
          name="unit"
          aria-label="Unit (optional)"
          defaultValue=""
          className={`${box} w-28 shrink-0`}
        >
          <option value="">—</option>
          {GROUPS.map((dimension) => (
            <optgroup key={dimension} label={DIMENSIONS[dimension].label}>
              {unitsFor(dimension).map((unit) => (
                <option key={unit} value={unit}>
                  {UNITS[unit].label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent min-h-12 shrink-0 rounded-xl px-5 font-medium disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {result?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {result.error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-muted text-[15px]">
          ✓ Added {result.data.name}
        </p>
      )}
    </form>
  );
}
