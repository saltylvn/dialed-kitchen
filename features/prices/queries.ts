import "server-only";
import { z } from "zod";
import { pricesByStore, type Observation, type StorePrice } from "@/lib/priceTrends";
import { createClient } from "@/lib/server/supabase";
import {
  itemRowSchema,
  priceRowSchema,
  storeRowSchema,
  type ItemRow,
  type PriceRow,
  type StoreRow,
} from "./schema";

// Reads for prices (data access layer: server-only, household-scoped by RLS, validated).
// Independent reads run in parallel, so each screen costs one round trip of waiting.

const PRICE_COLUMNS =
  "id, item_id, store_id, price, package_quantity, package_unit, observed_on, unit_price_base";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// A price book row (docs/decisions/0044): the item and its latest price at each store where
// it has one, cheapest first, the cheapest marked (ties all marked).
export type ItemWithStorePrices = ItemRow & { stores: PricedStore[] };
export type PricedStore = StorePrice & { latest: Observation };

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// Every item with its latest price at each store, alphabetically. Three reads in parallel;
// the view holds one row per item and store, so this stays small.
export async function listItemsWithStorePrices(): Promise<ItemWithStorePrices[]> {
  const supabase = await createClient();
  const [items, latest, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").order("name"),
    supabase
      .from("item_latest_store_prices")
      .select("item_id, store_id, unit_price_base, observed_on"),
    supabase.from("stores").select("id, name").order("sort_order"),
  ]);
  if (items.error) fail("items", items.error);
  if (latest.error) fail("item_latest_store_prices", latest.error);
  if (stores.error) fail("stores", stores.error);

  const storeRows = z.array(storeRowSchema).parse(stores.data);
  const byItem = new Map<string, Observation[]>();
  for (const row of z.array(latestStorePriceSchema).parse(latest.data)) {
    const list = byItem.get(row.item_id) ?? [];
    list.push(row);
    byItem.set(row.item_id, list);
  }

  return z
    .array(itemRowSchema)
    .parse(items.data)
    .map((item) => ({
      ...item,
      stores: pricesByStore(byItem.get(item.id) ?? [], storeRows).filter(
        (s): s is PricedStore => s.latest !== null,
      ),
    }));
}

const latestStorePriceSchema = z.object({
  item_id: z.uuid(),
  store_id: z.uuid(),
  unit_price_base: z.coerce.number(),
  observed_on: z.string(),
});

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

// The Log a price page: every item with its newest price per unit (where the wheels start) and the
// stores, read in parallel.
export async function getLogPricePage(): Promise<{
  items: {
    id: string;
    name: string;
    compareUnit: ItemRow["compare_unit"];
    lastUnitPriceBase: number | null; // the newest price, per gram, ml or item
  }[];
  stores: StoreRow[];
}> {
  const supabase = await createClient();
  const [items, latest, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").order("name"),
    // At most one row per item and store; the newest per item is picked below.
    supabase.from("item_latest_store_prices").select("item_id, unit_price_base, observed_on"),
    supabase.from("stores").select("id, name").order("sort_order"),
  ]);
  if (items.error) fail("items", items.error);
  if (latest.error) fail("item_latest_store_prices", latest.error);
  if (stores.error) fail("stores", stores.error);

  const newest = new Map<string, { unitPriceBase: number; observedOn: string }>();
  for (const row of z
    .array(
      z.object({
        item_id: z.uuid(),
        unit_price_base: z.coerce.number(),
        observed_on: z.string(),
      }),
    )
    .parse(latest.data)) {
    const seen = newest.get(row.item_id);
    if (!seen || row.observed_on > seen.observedOn) {
      newest.set(row.item_id, { unitPriceBase: row.unit_price_base, observedOn: row.observed_on });
    }
  }
  return {
    items: z
      .array(itemRowSchema)
      .parse(items.data)
      .map((i) => ({
        id: i.id,
        name: i.name,
        compareUnit: i.compare_unit,
        lastUnitPriceBase: newest.get(i.id)?.unitPriceBase ?? null,
      })),
    stores: z.array(storeRowSchema).parse(stores.data),
  };
}
