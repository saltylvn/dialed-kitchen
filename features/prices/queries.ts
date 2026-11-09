import "server-only";
import { z } from "zod";
import { itemPhotoSrc } from "@/lib/photos";
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

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ItemWithBest = ItemRow & {
  best: (BestPriceRow & { storeName: string }) | null;
  photo: string | null; // the photo's address, if the item has one
};

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

const photoRowSchema = z.object({ item_id: z.uuid(), updated_at: z.string() });

// Which items have a photo, as item id → the photo's address. Reads only the ids and dates,
// never the photos themselves (the browser fetches each one, and keeps it cached).
export async function readItemPhotos(
  supabase: SupabaseClient,
  itemId?: string,
): Promise<Map<string, string>> {
  const query = supabase.from("item_photos").select("item_id, updated_at");
  const { data, error } = await (itemId ? query.eq("item_id", itemId) : query);
  if (error) fail("item_photos", error);
  return new Map(
    z
      .array(photoRowSchema)
      .parse(data)
      .map((p) => [p.item_id, itemPhotoSrc(p.item_id, p.updated_at)]),
  );
}

// Every item with its best price, alphabetically.
export async function listItemsWithBest(client?: SupabaseClient): Promise<ItemWithBest[]> {
  const supabase = client ?? (await createClient());
  const [items, best, stores, photos] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit, emoji").order("name"),
    supabase.from("item_best_prices").select(BEST_COLUMNS),
    supabase.from("stores").select("id, name"),
    readItemPhotos(supabase),
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
      return {
        ...item,
        best: b ? { ...b, storeName: storeNames.get(b.store_id) ?? "" } : null,
        photo: photos.get(item.id) ?? null,
      };
    });
}

export type ItemPage = {
  item: ItemRow;
  photo: string | null; // the photo's address, if it has one
  history: (PriceRow & { storeName: string })[];
  stores: StoreRow[];
  bestPriceId: string | null;
};

// One item: its price history (newest first, most recent 100), best price and the
// household's stores (for the store suggestions). null if it doesn't exist or isn't yours.
export async function getItemPage(itemId: string): Promise<ItemPage | null> {
  if (!z.uuid().safeParse(itemId).success) return null;
  const supabase = await createClient();
  const [item, history, best, stores, photos] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit, emoji").eq("id", itemId).maybeSingle(),
    supabase
      .from("item_prices")
      .select(PRICE_COLUMNS)
      .eq("item_id", itemId)
      .order("observed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("item_best_prices").select("price_id").eq("item_id", itemId).maybeSingle(),
    supabase.from("stores").select("id, name").order("sort_order"),
    readItemPhotos(supabase, itemId),
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
    photo: photos.get(itemId) ?? null,
    history: z
      .array(priceRowSchema)
      .parse(history.data)
      .map((p) => ({ ...p, storeName: storeNames.get(p.store_id) ?? "" })),
    stores: storeList,
    bestPriceId: best.data ? z.uuid().parse(best.data.price_id) : null,
  };
}

// The Log a price page: every item with its last price (where the wheels start) and the
// stores, read in parallel.
export async function getLogPricePage(): Promise<{
  items: {
    id: string;
    name: string;
    compareUnit: ItemRow["compare_unit"];
    lastPrice: number | null;
  }[];
  stores: StoreRow[];
}> {
  const supabase = await createClient();
  const [items, latest, stores] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit").order("name"),
    // At most one row per item and store; the newest per item is picked below.
    supabase.from("item_latest_store_prices").select("item_id, price, observed_on"),
    supabase.from("stores").select("id, name").order("sort_order"),
  ]);
  if (items.error) fail("items", items.error);
  if (latest.error) fail("item_latest_store_prices", latest.error);
  if (stores.error) fail("stores", stores.error);

  const newest = new Map<string, { price: number; observedOn: string }>();
  for (const row of z
    .array(z.object({ item_id: z.uuid(), price: z.coerce.number(), observed_on: z.string() }))
    .parse(latest.data)) {
    const seen = newest.get(row.item_id);
    if (!seen || row.observed_on > seen.observedOn) {
      newest.set(row.item_id, { price: row.price, observedOn: row.observed_on });
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
        lastPrice: newest.get(i.id)?.price ?? null,
      })),
    stores: z.array(storeRowSchema).parse(stores.data),
  };
}
