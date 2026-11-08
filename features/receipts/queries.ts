import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/server/supabase";
import { itemRowSchema, storeRowSchema, type StoreRow } from "@/features/prices/schema";
import type { PriceBookItem } from "./components/ReceiptScanner";

// What the receipt screen needs: the price book (to pick items) and the stores (for the
// wheel), read in parallel.
export async function getReceiptPage(): Promise<{ items: PriceBookItem[]; stores: StoreRow[] }> {
  const supabase = await createClient();
  const [items, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").order("name"),
    supabase.from("stores").select("id, name").order("sort_order"),
  ]);
  if (items.error) throw new Error(`items failed: ${items.error.message}`);
  if (stores.error) throw new Error(`stores failed: ${stores.error.message}`);
  return {
    items: z
      .array(itemRowSchema)
      .parse(items.data)
      .map((i) => ({ id: i.id, name: i.name, compareUnit: i.compare_unit })),
    stores: z.array(storeRowSchema).parse(stores.data),
  };
}
