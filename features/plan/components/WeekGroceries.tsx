"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/pricing";
import type { WeekSummary } from "@/lib/weekShopping";
import { addWeekToList } from "../actions";

// "This week's groceries": what the planned meals need, its estimated cost at your best
// prices, and one tap to put it on the grocery list (skipping In stock and what's already
// there). The numbers come from the database's week_shopping (decision 0019).
export function WeekGroceries({ week, summary }: { week: string; summary: WeekSummary }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  function add() {
    setMessage(null);
    startTransition(async () => {
      const result = await addWeekToList(week);
      setMessage(
        result.ok
          ? {
              error: false,
              text:
                result.data.added === 1
                  ? "✓ Added 1 item to your grocery list."
                  : `✓ Added ${result.data.added} items to your grocery list.`,
            }
          : { error: true, text: result.error },
      );
    });
  }

  const counts = [
    `${summary.ingredients} ${summary.ingredients === 1 ? "ingredient" : "ingredients"}`,
    summary.inStock > 0 && `${summary.inStock} In stock`,
    summary.onList > 0 && `${summary.onList} on your list`,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="week-groceries"
      className="border-border bg-surface mb-4 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="week-groceries" className="font-medium">
          This week’s groceries
        </h2>
        <Link
          href={`/plan/prep?week=${week}`}
          className="-mt-3 -mr-2 flex min-h-12 shrink-0 items-center px-2 font-medium underline underline-offset-2"
        >
          Meal prep ›
        </Link>
      </div>
      <p className="text-muted text-[15px]">{counts.join(" · ")}</p>

      {summary.toBuy > 0 && (
        <p className="mt-2">
          {summary.cost === null ? (
            <span className="text-muted">
              No prices yet for these. Add prices on the Grocery tab to see a cost.
            </span>
          ) : (
            <>
              Estimated cost{" "}
              <span className="font-medium tabular-nums">{formatMoney(summary.cost)}</span>
              <span className="text-muted block text-[14px]">
                At your best prices
                {summary.priced < summary.toBuy &&
                  ` · ${summary.toBuy - summary.priced} of ${summary.toBuy} not priced yet`}
              </span>
            </>
          )}
        </p>
      )}

      {summary.toAdd > 0 ? (
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="bg-accent text-on-accent mt-3 min-h-12 w-full rounded-xl px-4 font-medium disabled:opacity-60"
        >
          {pending ? "Adding…" : `Add ${summary.toAdd} to grocery list`}
        </button>
      ) : (
        !message && <p className="mt-2 font-medium">✓ Everything is In stock or on your list.</p>
      )}

      {message && (
        <p role={message.error ? "alert" : "status"} className="mt-2 font-medium">
          {message.error ? "⚠️ " : ""}
          {message.text}{" "}
          {!message.error && (
            <Link href="/grocery" className="underline">
              Open list
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
