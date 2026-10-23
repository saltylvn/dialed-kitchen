import type { Metadata } from "next";
import { TabPage } from "@/components/ui/TabPage";
import { AddToListForm } from "@/features/list/components/AddToListForm";
import { GroceryViews } from "@/features/list/components/GroceryViews";
import { ShoppingList } from "@/features/list/components/ShoppingList";
import { StorePicker } from "@/features/list/components/StorePicker";
import { getListPage } from "@/features/list/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

// The shared grocery list: add what you need, then check it off in the store. Choosing the
// store shows each item's last price there next to its best price.
export default async function GroceryPage({ searchParams }: PageProps<"/grocery">) {
  const { store } = await searchParams;
  const [, page] = await Promise.all([
    requireUser(),
    getListPage(typeof store === "string" ? store : undefined),
  ]);

  return (
    <TabPage tab="grocery">
      <GroceryViews current="/grocery" />
      <div className="mt-5 space-y-4">
        <AddToListForm itemNames={page.itemNames} />
        <StorePicker stores={page.stores} current={page.store?.id ?? null} />
        <ShoppingList entries={page.entries} storeName={page.store?.name ?? null} />
      </div>
    </TabPage>
  );
}
