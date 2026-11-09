"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { groupByCategory } from "@/lib/foodCategory";
import { sortList } from "@/lib/list";
import { clearCheckedIntoStock, setInStock } from "@/features/stock/actions";
import { StorePrices } from "@/features/prices/components/StorePrices";
import type { StoreRow } from "@/features/prices/schema";
import { removeFromList, setChecked } from "../actions";
import type { ListEntry } from "../queries";
import { ItemSheet } from "./ItemSheet";

type Change = { type: "check"; id: string; checked: boolean } | { type: "remove"; id: string };

const part = "font-display text-[28px] leading-tight font-light italic";
const sectionHeading = "text-muted text-[12px] tracking-[0.2em] uppercase";

// The Grocery list and the Shopping kart (docs/decisions/0034). Ticking an item moves it
// from the list down to the kart, and back if unticked. Every row shows the item, a Log
// button and your stores' last prices, so you can compare as you shop. Taps update the
// screen instantly (optimistic UI) and save in the background; a failed save puts the
// screen back with a message.
export function GroceryLists({ entries, stores }: { entries: ListEntry[]; stores: StoreRow[] }) {
  const [optimistic, apply] = useOptimistic(entries, (state, change: Change) =>
    change.type === "remove"
      ? state.filter((e) => e.id !== change.id)
      : sortList(state.map((e) => (e.id === change.id ? { ...e, checked: change.checked } : e))),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ListEntry | null>(null); // the row whose Log sheet is open
  const [saved, setSaved] = useState<string | null>(null); // what the last price log said

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

  const toggle = (entry: ListEntry) =>
    run({ type: "check", id: entry.id, checked: !entry.checked }, () =>
      setChecked(entry.id, !entry.checked),
    );

  const toBuy = optimistic.filter((e) => !e.checked);
  const kart = optimistic.filter((e) => e.checked);

  const row = (entry: ListEntry) => (
    <Row
      key={entry.id}
      entry={entry}
      onToggle={() => toggle(entry)}
      onLog={() => {
        setSaved(null);
        setOpen(entry);
      }}
    />
  );

  return (
    <div className="space-y-10">
      {open && (
        <ItemSheet
          key={open.id}
          entry={open}
          stores={stores}
          onClose={() => setOpen(null)}
          onSaved={(message) => {
            setSaved(message);
            setOpen(null);
          }}
          onInStock={() => {
            setOpen(null);
            run({ type: "remove", id: open.id }, () => setInStock(open.name, true));
          }}
          onRemove={() => {
            setOpen(null);
            run({ type: "remove", id: open.id }, () => removeFromList(open.id));
          }}
        />
      )}

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className={part}>
          Grocery list
        </h2>
        {error && (
          <p role="alert" className="mt-3 font-medium">
            ⚠️ {error}
          </p>
        )}
        {saved && (
          <p
            role="status"
            className={`border-border bg-surface mt-3 rounded-xl border p-3 font-medium ${
              saved.includes("🎉") ? "text-success-text" : ""
            }`}
          >
            {saved}
          </p>
        )}
        {toBuy.length === 0 ? (
          <p className="text-muted border-border bg-surface mt-3 rounded-2xl border p-5 text-center">
            {kart.length > 0
              ? "Everything's in the kart. 🎉"
              : "Your list is empty. Add what you need above."}
          </p>
        ) : (
          <div className="mt-3 space-y-5">
            {groupByCategory(toBuy, (e) => e.name).map((group) => (
              <div key={group.id}>
                <h3 className={sectionHeading}>{group.label}</h3>
                <ul className="border-border bg-surface mt-2 divide-y divide-[var(--border)] rounded-2xl border">
                  {group.things.map(row)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="kart-heading">
        <h2 id="kart-heading" className={part}>
          Shopping kart
        </h2>
        {kart.length === 0 ? (
          <p className="text-muted mt-3 text-[15px]">Tick an item on the list and it moves here.</p>
        ) : (
          <>
            <ul className="border-border bg-surface mt-3 divide-y divide-[var(--border)] rounded-2xl border">
              {kart.map(row)}
            </ul>
            <form action={clearCheckedIntoStock} className="mt-3">
              <button
                type="submit"
                className="border-border min-h-12 w-full rounded-xl border font-medium"
              >
                Done shopping: put {kart.length} {kart.length === 1 ? "item" : "items"} In stock
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

// One row: checkbox and item on the left, Log in the middle, store prices on the right.
function Row({
  entry,
  onToggle,
  onLog,
}: {
  entry: ListEntry;
  onToggle: () => void;
  onLog: () => void;
}) {
  return (
    <li className="flex items-center gap-1.5 py-1.5 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={entry.checked}
        // Read out as "Rice, 2 lb, checkbox, not checked", then the store prices.
        aria-label={entry.amount ? `${entry.name}, ${entry.amount}` : entry.name}
        aria-describedby={`prices-${entry.id}`}
        onClick={onToggle}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2 pl-2 text-left"
      >
        <span
          aria-hidden
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-[17px] ${
            entry.checked ? "border-success bg-success text-surface" : "border-[var(--muted)]"
          }`}
        >
          {entry.checked ? "✓" : ""}
        </span>
        {/* The emoji stays beside the name; only the name wraps on a narrow phone. */}
        <span className="flex min-w-0 flex-1 items-start">
          <FoodEmoji name={entry.name} custom={entry.emoji} photo={entry.photo} />
          <span className="min-w-0 font-medium break-words">
            {entry.name}
            {entry.amount && <span className="text-muted block font-normal">{entry.amount}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onLog}
        aria-label={`Log a price for ${entry.name}, or more options`}
        className="border-border min-h-12 shrink-0 rounded-lg border px-2 text-[15px] font-medium"
      >
        Log
      </button>
      <StorePrices id={`prices-${entry.id}`} stores={entry.stores} unitLabel={entry.unitLabel} />
    </li>
  );
}
