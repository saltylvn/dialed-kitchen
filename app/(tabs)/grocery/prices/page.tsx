import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { GroceryViews } from "@/features/list/components/GroceryViews";
import { PriceBookRow } from "@/features/prices/components/PriceBookRow";
import { getPricesPage } from "@/features/prices/queries";
import { groupByCategory } from "@/lib/foodCategory";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Price Tracker · Dialed Kitchen" };

const heading = "text-muted text-[12px] tracking-[0.2em] uppercase";

// The price book: everything on the grocery list first, then every other item you buy,
// each grouped by store section with its best price and where it was found.
export default async function PricesPage() {
  const [, { onList, others }] = await Promise.all([requireUser(), getPricesPage()]);

  return (
    <TabPage tab="grocery">
      <GroceryViews current="/grocery/prices" />
      <div className="mt-5 flex justify-end gap-2">
        {/* Log a whole trip's prices from one photo (docs/decisions/0033). */}
        <Link
          href="/grocery/receipt"
          className="border-border bg-surface flex min-h-12 items-center rounded-xl border px-4 font-medium"
        >
          Scan a receipt
        </Link>
        <Link
          href="/grocery/items/new"
          className="bg-accent text-on-accent flex min-h-12 items-center rounded-xl px-4 font-medium"
        >
          Add item
        </Link>
      </div>

      {onList.length === 0 && others.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            heading="Start your price book"
            body="Scan a receipt to add a whole trip at once, or add things one by one and log prices as you shop. You'll always know the best price you've found, and where."
          />
        </div>
      ) : (
        <div className="mt-2 space-y-8">
          {onList.length > 0 && (
            <Part title="On your list">
              {groupByCategory(onList, (r) => r.name).map((group) => (
                <Section key={group.id} label={group.label}>
                  {group.things.map((row) => (
                    <PriceBookRow
                      key={row.entryId}
                      name={row.name}
                      item={row.item}
                      amount={row.amount}
                      checked={row.checked}
                    />
                  ))}
                </Section>
              ))}
            </Part>
          )}
          {others.length > 0 && (
            <Part title={onList.length > 0 ? "Rest of the price book" : "Price book"}>
              {groupByCategory(others, (i) => i.name).map((group) => (
                <Section key={group.id} label={group.label}>
                  {group.things.map((item) => (
                    <PriceBookRow key={item.id} name={item.name} item={item} />
                  ))}
                </Section>
              ))}
            </Part>
          )}
        </div>
      )}
    </TabPage>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[28px] leading-tight font-light italic">{title}</h2>
      <div className="mt-3 space-y-5">{children}</div>
    </section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={heading}>{label}</h3>
      <ul className="border-border bg-surface mt-2 divide-y divide-[var(--border)] rounded-2xl border">
        {children}
      </ul>
    </div>
  );
}
