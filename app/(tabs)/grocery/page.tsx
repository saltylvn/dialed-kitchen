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

const part = "heading-2";

// The three price tools: quiet, equal buttons, so the list below stays the focus.
const tool = "btn btn-secondary flex-1 px-2 text-[15px]";

// The Grocery tab (docs/decisions/0050, replacing the layout in 0035): list first, because
// in the store the list is what you need. Above it, one compact row to the price tools
// (Price book, Log a price, Scan a receipt); then the Grocery list with its add box at the
// top; then what's In stock. Ticking an item on the list moves it In stock, so what you
// need and what you have are together. All reads run in parallel.
export default async function GroceryPage() {
  const [, page, inStock] = await Promise.all([requireUser(), getListPage(), listInStock()]);

  return (
    <TabPage tab="grocery">
      <nav aria-label="Prices" className="flex gap-2">
        <Link href="/grocery/prices" className={tool}>
          Price book
        </Link>
        <Link href="/grocery/log" className={tool}>
          Log price
        </Link>
        <Link href="/grocery/receipt" className={tool}>
          Scan receipt
        </Link>
      </nav>

      <div className="mt-8">
        <GroceryList entries={page.entries} storeOrder={page.storeOrder}>
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
