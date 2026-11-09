import "server-only";
import { z } from "zod";
import { mainStorePrices } from "@/lib/mainStores";
import { itemPhotoSrc } from "@/lib/photos";
import { formatUnitAmount } from "@/lib/pricing";
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
  // WinCo, Trader Joe's, Harmons, always in that order, with the latest price at each.
  stores: { storeName: string; price: string | null; cheapest: boolean }[];
};

const latestAtStoreSchema = z.object({
  item_id: z.uuid(),
  store_id: z.uuid(),
  observed_on: z.string(),
  unit_price_base: z.coerce.number(),
});

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
  const [items, best, stores, photos, latest] = await Promise.all([
    supabase.from("items").select("id, name, compare_unit, emoji").order("name"),
    supabase.from("item_best_prices").select(BEST_COLUMNS),
    supabase.from("stores").select("id, name"),
    readItemPhotos(supabase),
    // At most one row per item and store (six stores), so it stays small.
    supabase
      .from("item_latest_store_prices")
      .select("item_id, store_id, observed_on, unit_price_base"),
  ]);
  if (latest.error) fail("item_latest_store_prices", latest.error);
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
  // item → store name → its latest price there
  const latestByItem = new Map<string, Map<string, { unitPrice: number; observedOn: string }>>();
  for (const row of z.array(latestAtStoreSchema).parse(latest.data)) {
    const byStore = latestByItem.get(row.item_id) ?? new Map();
    byStore.set(storeNames.get(row.store_id) ?? "", {
      unitPrice: row.unit_price_base,
      observedOn: row.observed_on,
    });
    latestByItem.set(row.item_id, byStore);
  }

  return z
    .array(itemRowSchema)
    .parse(items.data)
    .map((item) => {
      const b = bestByItem.get(item.id);
      const atStores = latestByItem.get(item.id);
      return {
        ...item,
        best: b ? { ...b, storeName: storeNames.get(b.store_id) ?? "" } : null,
        photo: photos.get(item.id) ?? null,
        stores: mainStorePrices((name) => atStores?.get(name)?.unitPrice ?? null).map((st) => ({
          storeName: st.storeName,
          price: st.unitPrice === null ? null : formatUnitAmount(st.unitPrice, item.compare_unit),
          cheapest: st.cheapest,
        })),
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
