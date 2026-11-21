"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/pricing";
import type { WeekCost } from "@/lib/weekCost";
import type { WeekSummary } from "@/lib/weekShopping";
import { addWeekToList, estimateMissingPrices } from "../actions";

// The seven days' groceries (on Plan, and at the top of Grocery): what the planned meals
// need, their estimated cost against the household's weekly budget (0053), and one tap to
// put them on the grocery list (skipping In stock and what's already there). The cost uses
// the price book's cheapest-now prices (0052), then saved AI estimates for the rest, always
// marked "~" (0057). The numbers come from the database's week_shopping (0019).
export function WeekGroceries({
  week,
  summary,
  cost,
  budget,
  title = "This week’s groceries",
  planLink = false,
}: {
  week: string;
  summary: WeekSummary;
  cost: WeekCost;
  budget: number | null;
  title?: string;
  planLink?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [estimating, startEstimate] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  function estimate() {
    setMessage(null);
    startEstimate(async () => {
      const result = await estimateMissingPrices(week);
      setMessage(
        result.ok
          ? {
              error: false,
              text:
                result.data.estimated === 0
                  ? "No estimates came back for these. Log their prices instead."
                  : `✓ Estimated ${result.data.estimated} ${result.data.estimated === 1 ? "price" : "prices"}.`,
            }
          : { error: true, text: result.error },
      );
    });
  }

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
      className="border-border bg-surface mb-4 rounded-xl border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-groceries" className="font-medium">
          {title}
        </h2>
        {planLink && (
          <Link href={`/plan?start=${week}`} className="text-muted min-h-12 text-[15px] underline">
            Plan
          </Link>
        )}
      </div>
      <p className="text-muted text-[15px]">{counts.join(" · ")}</p>

      {/* The estimated cost, once anything still to buy has a price or an estimate. */}
      {summary.toBuy > 0 && cost.total !== null && (
        <p className="mt-2">
          Estimated cost{" "}
          <span className="font-medium tabular-nums">
            {cost.fromEstimates > 0 ? "~" : ""}
            {formatMoney(cost.total)}
          </span>
          {budget !== null && (
            <span className="tabular-nums">
              {" "}
              of {formatMoney(budget)}
              {cost.total > budget ? (
                <span className="font-medium">
                  {" "}
                  · {formatMoney(cost.total - budget)} over budget
                </span>
              ) : (
                <span className="text-success-text"> · ✓ within budget</span>
              )}
            </span>
          )}
          <span className="text-muted block text-[14px] tabular-nums">
            {[
              cost.pricedCount > 0 && `${formatMoney(cost.fromPrices)} from your prices`,
              cost.estimatedCount > 0 && `~${formatMoney(cost.fromEstimates)} AI estimates`,
              cost.unpriced > 0 && `${cost.unpriced} not priced`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      )}
      {summary.toBuy > 0 && cost.total === null && (
        <p className="text-muted mt-2 text-[15px]">No prices yet for what these meals need.</p>
      )}

      {cost.toEstimate.length > 0 && (
        <button
          type="button"
          onClick={estimate}
          disabled={estimating}
          className="btn btn-secondary mt-3 w-full"
        >
          {estimating
            ? "Estimating…"
            : `Estimate ${cost.toEstimate.length} missing ${cost.toEstimate.length === 1 ? "price" : "prices"} with AI`}
        </button>
      )}

      {summary.toAdd > 0 ? (
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="bg-primary text-on-primary mt-3 min-h-12 w-full rounded-full px-4 font-medium disabled:opacity-60"
        >
          {pending ? "Adding…" : `Add ${summary.toAdd} to grocery list`}
        </button>
      ) : (
        !message && (
          <p className="text-success-text mt-2 font-medium">
            ✓ Everything is In stock or on your list.
          </p>
        )
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
