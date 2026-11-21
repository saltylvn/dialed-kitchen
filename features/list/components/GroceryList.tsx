"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { groupByCategory } from "@/lib/foodCategory";
import { formatMoney } from "@/lib/pricing";
import { groupByStore } from "@/lib/shopTrip";
import { setInStock } from "@/features/stock/actions";
import { addToList, removeFromList } from "../actions";
import type { ListEntry } from "../queries";

const part = "heading-2";
const sectionHeading = "label";

// The Grocery list (docs/decisions/0035, 0050), with the add box at its top. Ticking an item means you've got it: it leaves
// the list and goes In stock (the list below), with an Undo for a mis-tap. × takes an item
// off the list. Prices are in the Price book (linked at the top of the page). Taps update the
// screen instantly (optimistic UI) and save in the background; a failed save puts the
// screen back with a message.
export function GroceryList({
  entries,
  storeOrder,
  children,
}: {
  entries: ListEntry[];
  storeOrder: string[];
  children?: React.ReactNode; // the add box, shown above the list
}) {
  // Section: grouped like the store's aisles. Store: grouped by where each thing is cheapest
  // now, with an estimated subtotal per store, for a trip to several stores (decision 0052).
  const [view, setView] = useState<"section" | "store">("section");
  const [optimistic, remove] = useOptimistic(entries, (state, id: string) =>
    state.filter((e) => e.id !== id),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<ListEntry | null>(null); // the last item ticked In stock

  function run(entry: ListEntry, save: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      remove(entry.id);
      try {
        await save();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  function tick(entry: ListEntry) {
    setMoved(entry);
    run(entry, () => setInStock(entry.name, true));
  }

  // Put it back on the list (with its amount) and take it out of In stock.
  function undo(entry: ListEntry) {
    setMoved(null);
    setError(null);
    startTransition(async () => {
      try {
        await setInStock(entry.name, false);
        const form = new FormData();
        form.set("name", entry.name);
        if (entry.quantity !== null) form.set("quantity", String(entry.quantity));
        if (entry.unit) form.set("unit", entry.unit);
        const result = await addToList(null, form);
        if (result && !result.ok) setError(result.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't undo that.");
      }
    });
  }

  return (
    <section aria-labelledby="list-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="list-heading" className={part}>
          Grocery list
        </h2>
        <div
          role="group"
          aria-label="Group the list by"
          className="border-border flex rounded-lg border p-0.5"
        >
          {(
            [
              ["section", "Section"],
              ["store", "Store"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`min-h-11 rounded-md px-3 text-[15px] font-medium ${
                view === id ? "bg-primary text-on-primary" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">{children}</div>
      {error && (
        <p role="alert" className="mt-3 font-medium">
          ⚠️ {error}
        </p>
      )}
      {moved && (
        <p
          role="status"
          className="border-border bg-surface mt-3 flex items-center justify-between gap-3 rounded-lg border py-1 pr-1 pl-3"
        >
          <span>✓ {moved.name} is In stock</span>
          <button
            type="button"
            onClick={() => undo(moved)}
            className="min-h-12 shrink-0 rounded-lg px-3 font-medium underline"
          >
            Undo
          </button>
        </p>
      )}
      {optimistic.length === 0 ? (
        <p className="text-muted border-border mt-3 rounded-xl border border-dashed px-6 py-8 text-center">
          Your list is empty. Add what you need above.
        </p>
      ) : (
        <div className="mt-3 space-y-5">
          {(view === "store"
            ? groupByStore(optimistic, storeOrder).map((g) => ({
                id: g.storeId ?? "anywhere",
                label: g.label,
                note: storeNote(g.entries.length, g.subtotal, g.unpriced),
                things: g.entries,
              }))
            : groupByCategory(optimistic, (e) => e.name).map((g) => ({ ...g, note: null }))
          ).map((group) => (
            <div key={group.id}>
              <h3 className={sectionHeading}>
                {group.label}
                {group.note && <span className="tracking-normal normal-case"> · {group.note}</span>}
              </h3>
              <ul className="border-border bg-surface mt-2 divide-y divide-[var(--border)] rounded-xl border">
                {group.things.map((entry) => (
                  <Row
                    key={entry.id}
                    entry={entry}
                    onTick={() => tick(entry)}
                    onRemove={() => run(entry, () => removeFromList(entry.id))}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// "3 items · ~$12.40", plus how many have no estimate ("2 not priced").
function storeNote(count: number, subtotal: number, unpriced: number): string {
  const items = `${count} ${count === 1 ? "item" : "items"}`;
  const cost = subtotal > 0 ? ` · ~${formatMoney(subtotal)}` : "";
  const missing = unpriced > 0 && unpriced < count ? ` (${unpriced} not priced)` : "";
  return items + cost + missing;
}

// One row: checkbox and item, where it's cheapest now (if priced), then × (docs/decisions/0035, 0052).
function Row({
  entry,
  onTick,
  onRemove,
}: {
  entry: ListEntry;
  onTick: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-1.5 py-1.5 pr-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        // Read out as "Rice, 2 lb, checkbox, not checked: tick to move it In stock".
        aria-label={`${entry.amount ? `${entry.name}, ${entry.amount}` : entry.name}: tick to move it In stock`}
        aria-describedby={entry.best ? `best-${entry.id}` : undefined}
        onClick={onTick}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 pl-3 text-left"
      >
        <span
          aria-hidden
          className="border-text flex size-6 shrink-0 items-center justify-center rounded-md border-[1.5px]"
        />
        {/* The emoji stays beside the name; only the name wraps on a narrow phone. */}
        <span className="flex min-w-0 flex-1 items-start">
          <FoodEmoji name={entry.name} />
          <span className="min-w-0 font-medium break-words">
            {entry.name}
            {entry.amount && <span className="text-muted block font-normal">{entry.amount}</span>}
          </span>
        </span>
      </button>
      {entry.best && (
        // The best price found so far, for context while shopping (docs/decisions/0035).
        <p
          id={`best-${entry.id}`}
          className="w-[6.5rem] shrink-0 text-right text-[14px] leading-snug"
        >
          <span className="label block">Cheapest</span>
          <span className="block font-medium">{entry.best.price}</span>
          <span className="text-muted block">
            {entry.best.store}
            {entry.best.older && " · older"}
          </span>
        </p>
      )}
      <button
        type="button"
        aria-label={`Remove ${entry.name} from the list`}
        onClick={onRemove}
        className="text-muted flex size-12 shrink-0 items-center justify-center text-xl"
      >
        ×
      </button>
    </li>
  );
}
