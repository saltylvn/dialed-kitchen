import type { Metadata } from "next";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

// The grocery list and prices: what to buy, and the best price found for each item.
export default async function GroceryPage() {
  await requireUser();

  return (
    <TabPage tab="grocery">
      <EmptyState
        heading="Your grocery list"
        body="Add what you need, check it off in the store, and see the best price you've found for each item."
      />
    </TabPage>
  );
}
