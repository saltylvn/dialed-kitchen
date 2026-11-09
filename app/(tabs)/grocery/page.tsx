import type { Metadata } from "next";
import Link from "next/link";
import { TabPage } from "@/components/ui/TabPage";
import { AddToListForm } from "@/features/list/components/AddToListForm";
import { GroceryList } from "@/features/list/components/GroceryList";
import { getListPage } from "@/features/list/queries";
import { StockList } from "@/features/stock/components/StockList";
import { listInStock } from "@/features/stock/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

const part = "font-display text-[28px] leading-tight font-light italic";

// The same button style as Add item on the Price book page.
const button = "flex min-h-12 items-center justify-center rounded-xl px-3 font-medium";

// The Grocery tab (docs/decisions/0035): the price buttons (Price book in the accent color,
// Log a price and Scan a receipt side by side below it), then the Grocery list (with its add
// box at the end), then what's In stock. Ticking an item on the list moves it In stock, so
// what you need and what you have are together. Prices live in the Price book, one tap from
// each item. All reads run in parallel.
export default async function GroceryPage() {
  const [, page, inStock] = await Promise.all([requireUser(), getListPage(), listInStock()]);

  return (
    <TabPage tab="grocery">
      <nav aria-label="Prices" className="space-y-2">
        <Link href="/grocery/prices" className={`${button} bg-accent text-on-accent w-full`}>
          Price book
        </Link>
        <div className="flex gap-2">
          <Link href="/grocery/log" className={`${button} border-border bg-surface flex-1 border`}>
            Log a price
          </Link>
          <Link
            href="/grocery/receipt"
            className={`${button} border-border bg-surface flex-1 border`}
          >
            Scan a receipt
          </Link>
        </div>
      </nav>

      <div className="mt-8">
        <GroceryList entries={page.entries}>
          <AddToListForm itemNames={page.itemNames} />
        </GroceryList>
      </div>

      <section id="in-stock" aria-labelledby="stock-heading" className="mt-10 scroll-mt-4">
        <h2 id="stock-heading" className={`${part} mb-4`}>
          In stock
        </h2>
        <StockList items={inStock} />
      </section>
    </TabPage>
  );
}
