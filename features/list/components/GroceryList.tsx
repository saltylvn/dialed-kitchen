"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { groupByCategory } from "@/lib/foodCategory";
import { setInStock } from "@/features/stock/actions";
import { addToList, removeFromList } from "../actions";
import type { ListEntry } from "../queries";

const part = "font-display text-[28px] leading-tight font-light italic";
const sectionHeading = "text-muted text-[12px] tracking-[0.2em] uppercase";

// The Grocery list (docs/decisions/0035), with the add box at its end. Ticking an item means you've got it: it leaves
// the list and goes In stock (the list below), with an Undo for a mis-tap. × takes an item
// off the list. Prices are in the Price book (the button at the top of the page). Taps update the
// screen instantly (optimistic UI) and save in the background; a failed save puts the
// screen back with a message.
export function GroceryList({
  entries,
  children,
}: {
  entries: ListEntry[];
  children?: React.ReactNode; // the add box, shown under the list
}) {
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
      <h2 id="list-heading" className={part}>
        Grocery list
      </h2>
      {error && (
        <p role="alert" className="mt-3 font-medium">
          ⚠️ {error}
        </p>
      )}
      {moved && (
        <p
          role="status"
          className="border-border bg-surface mt-3 flex items-center justify-between gap-3 rounded-xl border py-1 pr-1 pl-3"
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
        <p className="text-muted border-border bg-surface mt-3 rounded-2xl border p-5 text-center">
          Your list is empty. Add what you need above.
        </p>
      ) : (
        <div className="mt-3 space-y-5">
          {groupByCategory(optimistic, (e) => e.name).map((group) => (
            <div key={group.id}>
              <h3 className={sectionHeading}>{group.label}</h3>
              <ul className="border-border bg-surface mt-2 divide-y divide-[var(--border)] rounded-2xl border">
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
      <div className="mt-4">{children}</div>
    </section>
  );
}

// One row: checkbox and item, the best price so far (if any), then × (docs/decisions/0035).
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
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--muted)]"
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
          <span className="text-muted block text-[12px] tracking-[0.1em] uppercase">Best</span>
          <span className="block font-medium">{entry.best.price}</span>
          <span className="text-muted block">{entry.best.store}</span>
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
