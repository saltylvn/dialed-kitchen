import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TabPage } from "@/components/ui/TabPage";
import { AddToListForm } from "@/features/list/components/AddToListForm";
import { GroceryViews } from "@/features/list/components/GroceryViews";
import { ShoppingList } from "@/features/list/components/ShoppingList";
import { StorePicker } from "@/features/list/components/StorePicker";
import { getListPage } from "@/features/list/queries";
import { SHOPPING_STORE_COOKIE } from "@/features/list/schema";
import { StockList } from "@/features/stock/components/StockList";
import { listInStock } from "@/features/stock/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery List · Dialed Kitchen" };

const part = "font-display text-[28px] leading-tight font-light italic";

// The Grocery List sub-tab: the shared list (add what you need, check it off in the store),
// then what's already In stock at home, so both are on one screen. The store you're at is
// remembered on this phone (a cookie): each item then shows its price here against your
// other stores, and checking it off offers to log today's price (docs/decisions/0032).
export default async function GroceryPage() {
  const store = (await cookies()).get(SHOPPING_STORE_COOKIE)?.value;
  const [, page, inStock] = await Promise.all([
    requireUser(),
    getListPage(store), // checked against your stores there
    listInStock(),
  ]);

  return (
    <TabPage tab="grocery">
      <GroceryViews current="/grocery" />
      <section aria-labelledby="list-heading" className="mt-5 space-y-4">
        <h2 id="list-heading" className={part}>
          To buy
        </h2>
        <AddToListForm itemNames={page.itemNames} />
        <StorePicker stores={page.stores} current={page.store?.id ?? null} />
        <ShoppingList entries={page.entries} store={page.store} stores={page.stores} />
      </section>
      <section id="in-stock" aria-labelledby="stock-heading" className="mt-10 scroll-mt-4">
        <h2 id="stock-heading" className={`${part} mb-4`}>
          In stock
        </h2>
        <StockList items={inStock} />
      </section>
    </TabPage>
  );
}
