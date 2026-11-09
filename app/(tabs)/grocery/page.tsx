import type { Metadata } from "next";
import Link from "next/link";
import { TabPage } from "@/components/ui/TabPage";
import { AddToListForm } from "@/features/list/components/AddToListForm";
import { GroceryLists } from "@/features/list/components/GroceryLists";
import { getListPage } from "@/features/list/queries";
import { StockList } from "@/features/stock/components/StockList";
import { listInStock } from "@/features/stock/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

const part = "font-display text-[28px] leading-tight font-light italic";
const link =
  "border-border bg-surface flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 font-medium";

// The Grocery tab, all in one (docs/decisions/0034): the Grocery list, the Shopping kart and
// what's In stock, top to bottom, so what you need, what you've picked up and what you have
// are together. Every list item shows your stores' last prices to compare as you shop.
// All reads run in parallel.
export default async function GroceryPage() {
  const [, page, inStock] = await Promise.all([requireUser(), getListPage(), listInStock()]);

  return (
    <TabPage tab="grocery">
      <div className="space-y-3">
        <AddToListForm itemNames={page.itemNames} />
        <div className="flex gap-2">
          <Link href="/grocery/receipt" className={link}>
            Scan a receipt
          </Link>
          <Link href="/grocery/prices" className={link}>
            Price book
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <GroceryLists entries={page.entries} stores={page.stores} />
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
