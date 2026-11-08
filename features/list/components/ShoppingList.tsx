"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { sortList } from "@/lib/list";
import { clearCheckedIntoStock, setInStock } from "@/features/stock/actions";
import type { StoreRow } from "@/features/prices/schema";
import { removeFromList, setChecked } from "../actions";
import type { ListEntry } from "../queries";
import { QuickLogSheet } from "./QuickLogSheet";

type Change = { type: "check"; id: string; checked: boolean } | { type: "remove"; id: string };

// The list you shop from. Taps update the screen instantly (optimistic UI) and save in the
// background; if a save fails, the screen goes back to the saved state with a message.
// In a store, each item shows its price here against your other stores, and checking one
// off opens a quick price log for it (docs/decisions/0032).
export function ShoppingList({
  entries,
  store,
  stores,
}: {
  entries: ListEntry[];
  store: StoreRow | null;
  stores: StoreRow[];
}) {
  const [optimistic, apply] = useOptimistic(entries, (state, change: Change) =>
    change.type === "remove"
      ? state.filter((e) => e.id !== change.id)
      : sortList(state.map((e) => (e.id === change.id ? { ...e, checked: change.checked } : e))),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<ListEntry | null>(null); // the quick log's item
  const [saved, setSaved] = useState<string | null>(null); // what the last quick log said

  function toggle(entry: ListEntry) {
    const checked = !entry.checked;
    run({ type: "check", id: entry.id, checked }, () => setChecked(entry.id, checked));
    // Just put it in the cart, at a store, and it's in the price book: log today's price.
    if (checked && store && entry.quickLog) {
      setSaved(null);
      setLogging(entry);
    }
  }

  function run(change: Change, save: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      apply(change);
      try {
        await save();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  const checkedCount = optimistic.filter((e) => e.checked).length;

  if (optimistic.length === 0) {
    return (
      <p className="text-muted border-border bg-surface rounded-2xl border p-5 text-center">
        Your list is empty. Add what you need above.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 font-medium">
          ⚠️ {error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className={`border-border bg-surface mb-3 rounded-xl border p-3 font-medium ${
            saved.includes("🎉") ? "text-success-text" : ""
          }`}
        >
          {saved}
        </p>
      )}
      {logging?.quickLog && store && (
        <QuickLogSheet
          key={logging.id}
          entry={logging}
          quickLog={logging.quickLog}
          store={store}
          stores={stores}
          onClose={() => setLogging(null)}
          onSaved={(message) => {
            setSaved(message);
            setLogging(null);
          }}
        />
      )}
      <ul className="border-border bg-surface divide-y divide-[var(--border)] rounded-2xl border">
        {optimistic.map((entry) => (
          <li key={entry.id} className="flex items-center">
            <button
              type="button"
              role="checkbox"
              aria-checked={entry.checked}
              // Read out as "Rice, 2 lb, checkbox, not checked", then the prices.
              aria-label={entry.amount ? `${entry.name}, ${entry.amount}` : entry.name}
              aria-describedby={showPrices(entry) ? `prices-${entry.id}` : undefined}
              onClick={() => toggle(entry)}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left"
            >
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-[17px] ${
                  entry.checked ? "border-success bg-success text-surface" : "border-[var(--muted)]"
                }`}
              >
                {entry.checked ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block break-words ${entry.checked ? "text-muted line-through" : "font-medium"}`}
                >
                  <FoodEmoji name={entry.name} custom={entry.emoji} photo={entry.photo} />
                  {entry.name}
                  {entry.amount && (
                    <span className="text-muted font-normal"> · {entry.amount}</span>
                  )}
                </span>
                {showPrices(entry) && (
                  <PriceLine id={`prices-${entry.id}`} entry={entry} store={store} />
                )}
              </span>
            </button>
            {!entry.checked && (
              <button
                type="button"
                aria-label={`${entry.name}: In stock, take it off the list`}
                onClick={() =>
                  run({ type: "remove", id: entry.id }, () => setInStock(entry.name, true))
                }
                className="text-muted border-border my-1 flex min-h-12 shrink-0 items-center rounded-lg border px-2.5 text-[14px]"
              >
                In stock
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove ${entry.name} from the list`}
              onClick={() => run({ type: "remove", id: entry.id }, () => removeFromList(entry.id))}
              className="text-muted flex size-12 shrink-0 items-center justify-center text-xl"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {checkedCount > 0 && (
        <form action={clearCheckedIntoStock} className="mt-3">
          <button
            type="submit"
            className="border-border min-h-12 w-full rounded-xl border font-medium"
          >
            Clear checked ({checkedCount})
          </button>
          <p className="text-muted mt-1 text-center text-[14px]">Bought items go In stock.</p>
        </form>
      )}
    </div>
  );
}

function showPrices(entry: ListEntry): boolean {
  return !entry.checked && entry.stores.length > 0;
}

// Under each item: in a store, its price here and whether one of your stores is cheaper;
// otherwise your stores' prices, cheapest first. Words carry the meaning, never color alone.
function PriceLine({ id, entry, store }: { id: string; entry: ListEntry; store: StoreRow | null }) {
  const unit = entry.unitLabel ? ` ${entry.unitLabel}` : "";
  if (!store) {
    const priced = entry.stores.filter((s) => s.price !== null);
    return (
      <span id={id} className="text-muted block text-[15px]">
        {priced.map((s) => `${s.storeName} ${s.price}`).join(" · ")}
        {unit}
      </span>
    );
  }
  return (
    <span id={id} className="block text-[15px]">
      {entry.here ? (
        <span className="text-muted">
          Here {entry.here.price}
          {unit}
        </span>
      ) : (
        <span className="text-muted">No price here yet</span>
      )}
      {entry.cheaper && (
        <span className="font-medium">
          {" "}
          · {entry.cheaper.storeName} {entry.cheaper.price}
          {entry.here
            ? ` ↓ ${entry.cheaper.percentLess >= 1 ? `${entry.cheaper.percentLess}%` : "a bit"} less`
            : unit}
        </span>
      )}
      {entry.cheapestHere && (
        <span className="text-success-text font-medium"> · ✓ Cheapest here</span>
      )}
    </span>
  );
}
