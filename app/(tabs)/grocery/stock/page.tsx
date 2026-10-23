import type { Metadata } from "next";
import { TabPage } from "@/components/ui/TabPage";
import { GroceryViews } from "@/features/list/components/GroceryViews";
import { StockList } from "@/features/stock/components/StockList";
import { listInStock } from "@/features/stock/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "In stock · Dialed Kitchen" };

// What's In stock in your kitchen, shared with your partner. Recipes and the grocery list
// both use it: In stock ingredients aren't added to the list.
export default async function InStockPage() {
  const [, items] = await Promise.all([requireUser(), listInStock()]);

  return (
    <TabPage tab="grocery">
      <GroceryViews current="/grocery/stock" />
      <div className="mt-5">
        <StockList items={items} />
      </div>
    </TabPage>
  );
}
