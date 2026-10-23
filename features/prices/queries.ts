import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/server/supabase";
import {
  bestPriceRowSchema,
  itemRowSchema,
  priceRowSchema,
  storeRowSchema,
  type BestPriceRow,
  type ItemRow,
  type PriceRow,
  type StoreRow,
} from "./schema";

// Reads for prices (data access layer: server-only, household-scoped by RLS, validated).
// Independent reads run in parallel, so each screen costs one round trip of waiting.

const PRICE_COLUMNS =
  "id, item_id, store_id, price, package_quantity, package_unit, on_sale, observed_on, unit_price_base";
const BEST_COLUMNS =
  "price_id, item_id, store_id, price, package_quantity, package_unit, on_sale, observed_on, unit_price_base";

export type ItemWithBest = ItemRow & { best: (BestPriceRow & { storeName: string }) | null };

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// Every item with its best price, alphabetically.
export async function listItemsWithBest(): Promise<ItemWithBest[]> {
  const supabase = await createClient();
  const [items, best, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").order("name"),
    supabase.from("item_best_prices").select(BEST_COLUMNS),
    supabase.from("stores").select("id, name"),
  ]);
  if (items.error) fail("items", items.error);
  if (best.error) fail("item_best_prices", best.error);
  if (stores.error) fail("stores", stores.error);

  const storeNames = new Map(
    z
      .array(storeRowSchema)
      .parse(stores.data)
      .map((s) => [s.id, s.name]),
  );
  const bestByItem = new Map(
    z
      .array(bestPriceRowSchema)
      .parse(best.data)
      .map((b) => [b.item_id, b]),
  );
  return z
    .array(itemRowSchema)
    .parse(items.data)
    .map((item) => {
      const b = bestByItem.get(item.id);
      return { ...item, best: b ? { ...b, storeName: storeNames.get(b.store_id) ?? "" } : null };
    });
}

export type ItemPage = {
  item: ItemRow;
  history: (PriceRow & { storeName: string })[];
  stores: StoreRow[];
  bestPriceId: string | null;
};

// One item: its price history (newest first, most recent 100), best price and the
// household's stores (for the store suggestions). null if it doesn't exist or isn't yours.
export async function getItemPage(itemId: string): Promise<ItemPage | null> {
  if (!z.uuid().safeParse(itemId).success) return null;
  const supabase = await createClient();
  const [item, history, best, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").eq("id", itemId).maybeSingle(),
    supabase
      .from("item_prices")
      .select(PRICE_COLUMNS)
      .eq("item_id", itemId)
      .order("observed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("item_best_prices").select("price_id").eq("item_id", itemId).maybeSingle(),
    supabase.from("stores").select("id, name").order("sort_order"),
  ]);
  if (item.error) fail("item", item.error);
  if (history.error) fail("item_prices", history.error);
  if (best.error) fail("item_best_prices", best.error);
  if (stores.error) fail("stores", stores.error);
  if (!item.data) return null;

  const storeList = z.array(storeRowSchema).parse(stores.data);
  const storeNames = new Map(storeList.map((s) => [s.id, s.name]));
  return {
    item: itemRowSchema.parse(item.data),
    history: z
      .array(priceRowSchema)
      .parse(history.data)
      .map((p) => ({ ...p, storeName: storeNames.get(p.store_id) ?? "" })),
    stores: storeList,
    bestPriceId: best.data ? z.uuid().parse(best.data.price_id) : null,
  };
}
