"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { addInStock, setInStock, type AddInStockResult } from "../actions";
import type { StockRow } from "../queries";

// What's In stock in your kitchen. "Used up" removes it, so recipes show it as needed again.
export function StockList({ items }: { items: StockRow[] }) {
  const [optimistic, remove] = useOptimistic(items, (state, id: string) =>
    state.filter((i) => i.id !== id),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, formAction, pending] = useActionState<AddInStockResult, FormData>(addInStock, null);

  function usedUp(item: StockRow) {
    setError(null);
    startTransition(async () => {
      remove(item.id);
      try {
        await setInStock(item.name, false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex gap-2">
        <label htmlFor="stock-name" className="sr-only">
          Add something In stock
        </label>
        <input
          id="stock-name"
          name="name"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Add something In stock…"
          className="border-border bg-surface min-h-12 min-w-0 flex-1 rounded-xl border px-3 text-[17px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent min-h-12 shrink-0 rounded-xl px-5 font-medium disabled:opacity-60"
        >
          Add
        </button>
      </form>
      {added?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {added.error}
        </p>
      )}
      {error && (
        <p role="alert" className="font-medium">
          ⚠️ {error}
        </p>
      )}

      {optimistic.length === 0 ? (
        <p className="text-muted border-border bg-surface rounded-2xl border p-5 text-center">
          Nothing marked In stock yet. Tick In stock on a recipe or the list, or add it above.
        </p>
      ) : (
        <ul className="border-border bg-surface divide-y divide-[var(--border)] rounded-2xl border">
          {optimistic.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-3 pl-4">
              <span aria-hidden className="text-success-text">
                ✓
              </span>
              <span className="min-w-0 flex-1 break-words">{item.name}</span>
              <button
                type="button"
                aria-label={`${item.name}: used up`}
                onClick={() => usedUp(item)}
                className="text-muted border-border mr-2 flex min-h-12 shrink-0 items-center rounded-lg border px-3 text-[14px]"
              >
                Used up
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
