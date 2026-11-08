"use client";

import { startTransition, useOptimistic } from "react";
import type { StoreRow } from "@/features/prices/schema";
import { MAIN_STORES } from "@/lib/mainStores";
import { chooseStore } from "../actions";

// "Shopping at": your three main stores as big buttons, the others in a menu. The choice is
// remembered on this phone (chooseStore sets a cookie) and shows each item's price here
// against your other stores. The button lights up on tap (optimistic), then the page
// refreshes with that store's prices.
export function StorePicker({ stores, current }: { stores: StoreRow[]; current: string | null }) {
  const [selected, select] = useOptimistic(current);
  if (stores.length === 0) return null;

  const main = MAIN_STORES.flatMap((name) => stores.filter((s) => s.name === name));
  const others = stores.filter((s) => !main.includes(s));
  const otherSelected = others.some((s) => s.id === selected);

  function pick(storeId: string) {
    startTransition(async () => {
      select(storeId || null);
      const form = new FormData();
      form.set("storeId", storeId);
      await chooseStore(form);
    });
  }

  return (
    <fieldset>
      <legend className="text-muted mb-2 text-[15px]">Shopping at</legend>
      <div className="flex gap-2">
        {main.map((store) => {
          const active = store.id === selected;
          return (
            <button
              key={store.id}
              type="button"
              aria-pressed={active}
              onClick={() => pick(active ? "" : store.id)} // tap again to clear
              className={`min-h-12 flex-1 rounded-xl border px-1 text-[15px] leading-tight ${
                active
                  ? "bg-accent text-on-accent border-transparent font-medium"
                  : "border-border bg-surface"
              }`}
            >
              {active && <span aria-hidden>✓ </span>}
              {store.name}
            </button>
          );
        })}
      </div>
      {others.length > 0 && (
        <div className="mt-2">
          <label htmlFor="other-store" className="sr-only">
            Another store
          </label>
          {/* A native menu: on iPhone it opens as the swipe wheel. */}
          <select
            id="other-store"
            value={otherSelected ? (selected ?? "") : ""}
            onChange={(e) => pick(e.target.value)}
            className={`min-h-12 w-full rounded-xl border px-3 text-[15px] ${
              otherSelected
                ? "bg-accent text-on-accent border-transparent font-medium"
                : "border-border bg-surface text-muted"
            }`}
          >
            <option value="">{otherSelected ? "Not in a store" : "Another store…"}</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === selected ? `✓ ${s.name}` : s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}
