import type { Metadata } from "next";
import Link from "next/link";
import { SubPage } from "@/components/ui/SubPage";
import { EmptyState } from "@/components/ui/TabPage";
import { PriceBookRow } from "@/features/prices/components/PriceBookRow";
import { listItemsWithBest } from "@/features/prices/queries";
import { groupByCategory } from "@/lib/foodCategory";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Price book · Dialed Kitchen" };

const heading = "text-muted text-[12px] tracking-[0.2em] uppercase";
const button = "flex min-h-12 flex-1 items-center justify-center rounded-xl px-3 font-medium";

// The price book: every item you've priced, on the list or not, grouped by store section,
// each with your stores' last prices (docs/decisions/0034). Opened from the Grocery page.
export default async function PriceBookPage() {
  const [, items] = await Promise.all([requireUser(), listItemsWithBest()]);

  return (
    <SubPage backHref="/grocery" backLabel="Grocery" title="Price book">
      <div className="flex gap-2">
        <Link href="/grocery/receipt" className={`${button} border-border bg-surface border`}>
          Scan a receipt
        </Link>
        <Link href="/grocery/items/new" className={`${button} bg-accent text-on-accent`}>
          Add item
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            heading="Start your price book"
            body="Scan a receipt to add a whole trip at once, or add things one by one and log prices as you shop. You'll always know the best price you've found, and where."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {groupByCategory(items, (i) => i.name).map((group) => (
            <div key={group.id}>
              <h2 className={heading}>{group.label}</h2>
              <ul className="border-border bg-surface mt-2 divide-y divide-[var(--border)] rounded-2xl border">
                {group.things.map((item) => (
                  <PriceBookRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SubPage>
  );
}
