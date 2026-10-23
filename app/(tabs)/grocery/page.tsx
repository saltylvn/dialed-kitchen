import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { BestPriceLine } from "@/features/prices/components/BestPriceLine";
import { listItemsWithBest } from "@/features/prices/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

// The grocery tab. For now: every item you buy with the best price you've found for it.
// (The shopping list joins it in Milestone 3.)
export default async function GroceryPage() {
  const [, items] = await Promise.all([requireUser(), listItemsWithBest()]);

  return (
    <TabPage tab="grocery">
      <div className="flex items-center justify-between">
        <h2 className="text-muted text-[12px] tracking-[0.2em] uppercase">Best prices</h2>
        <Link
          href="/grocery/items/new"
          className="bg-accent text-on-accent flex min-h-12 items-center rounded-xl px-4 font-medium"
        >
          Add item
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            heading="Start your price book"
            body="Add the things you buy, then log prices as you shop. You'll always know the best price you've found, and where."
          />
        </div>
      ) : (
        <ul className="border-border bg-surface mt-4 divide-y divide-[var(--border)] rounded-2xl border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/grocery/items/${item.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{item.name}</span>
                  <span className="mt-0.5 block text-[15px]">
                    {item.best ? (
                      <BestPriceLine
                        unitPriceBase={item.best.unit_price_base}
                        compareUnit={item.compare_unit}
                        storeName={item.best.storeName}
                        observedOn={item.best.observed_on}
                        onSale={item.best.on_sale}
                      />
                    ) : (
                      <span className="text-muted">No prices yet</span>
                    )}
                  </span>
                </span>
                <span aria-hidden className="text-muted text-xl">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TabPage>
  );
}
