"use client";

import { useActionState } from "react";
import { DIMENSIONS, unitsFor, type Dimension } from "@/lib/units";
import { createItem, type CreateItemResult } from "../actions";
import { compareUnitLabel } from "../schema";

const GROUPS: Dimension[] = ["weight", "volume", "count"];

export function CreateItemForm() {
  const [result, formAction, pending] = useActionState<CreateItemResult, FormData>(
    createItem,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="item-name" className="font-medium">
          Name
        </label>
        <input
          id="item-name"
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder="Chicken thighs"
          className="border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]"
        />
      </div>

      <div>
        <label htmlFor="item-unit" className="font-medium">
          Compare prices
        </label>
        <p className="text-muted text-[15px]">
          How prices for this item are shown, so different package sizes compare fairly.
        </p>
        <select
          id="item-unit"
          name="compareUnit"
          defaultValue="lb"
          className="border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]"
        >
          {GROUPS.map((dimension) => (
            <optgroup key={dimension} label={DIMENSIONS[dimension].label}>
              {unitsFor(dimension).map((unit) => (
                <option key={unit} value={unit}>
                  {compareUnitLabel(unit)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
        {pending ? "Adding…" : "Add item"}
      </button>
    </form>
  );
}
