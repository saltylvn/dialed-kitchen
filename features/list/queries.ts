import "server-only";
import { z } from "zod";
import { formatAmount, sortList } from "@/lib/list";
import { LOG_STORES, mainStorePrices } from "@/lib/mainStores";
import { itemIdFor, nameKey } from "@/lib/priceBook";
import { formatUnitAmount } from "@/lib/pricing";
import { createClient } from "@/lib/server/supabase";
import type { Unit } from "@/lib/units";
import { readItemPhotos } from "@/features/prices/queries";
import {
  compareUnitLabel,
  itemRowSchema,
  storeRowSchema,
  type StoreRow,
} from "@/features/prices/schema";
import { listRowSchema } from "./schema";

// The Grocery page in one round trip of waiting: the list, the price book, stores, photos and
// the latest price of every item at every store, all read in parallel. Prices are turned into
// display text here, so the browser only gets what it shows (docs/decisions/0034).

export type ListEntry = {
  id: string;
  itemId: string | null;
  name: string;
  emoji: string | null; // the item's custom emoji, if one was chosen
  photo: string | null; // the item's photo address, if it has one
  amount: string;
  checked: boolean; // in the shopping kart
  createdAt: string;
  unitLabel: string | null; // "per lb", "each": the unit every price below is in
  // WinCo, Trader Joe's, Harmons, always in that order; empty if not in the price book.
  stores: { storeName: string; price: string | null; cheapest: boolean }[];
  quickLog: QuickLog | null; // what "Log" starts from; null if not in the price book
};

// Where the price sheet starts: the last price at the wheel's first store (Trader Joe's),
// else the most recent anywhere (same package, usually), so an unchanged price is one tap.
export type QuickLog = {
  itemId: string;
  compareUnit: Unit;
  price: number | null;
  quantity: number | null;
  unit: Unit | null;
  from: string | null; // the store the starting price was logged at
};

export type ListPage = {
  entries: ListEntry[];
  stores: StoreRow[];
  itemNames: string[]; // the price book, for suggestions when adding
};

const latestRowSchema = z.object({
  item_id: z.uuid(),
  store_id: z.uuid(),
  price: z.coerce.number(),
  package_quantity: z.coerce.number(),
  package_unit: itemRowSchema.shape.compare_unit,
  observed_on: z.string(),
  unit_price_base: z.coerce.number(),
});
type LatestRow = z.infer<typeof latestRowSchema>;

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export async function getListPage(): Promise<ListPage> {
  const supabase = await createClient();

  const [list, items, stores, latest, photos] = await Promise.all([
    supabase
      .from("grocery_list_items")
      .select("id, item_id, name, quantity, unit, checked, created_at"),
    supabase.from("items").select("id, name, compare_unit, emoji").order("name"),
    supabase.from("stores").select("id, name").order("sort_order"),
    // At most one row per item and store (six stores).
    supabase
      .from("item_latest_store_prices")
      .select(
        "item_id, store_id, price, package_quantity, package_unit, observed_on, unit_price_base",
      ),
    readItemPhotos(supabase),
  ]);
  if (list.error) fail("grocery_list_items", list.error);
  if (items.error) fail("items", items.error);
  if (stores.error) fail("stores", stores.error);
  if (latest.error) fail("item_latest_store_prices", latest.error);

  const itemList = z.array(itemRowSchema).parse(items.data);
  const storeList = z.array(storeRowSchema).parse(stores.data);
  const units = new Map(itemList.map((i) => [i.id, i.compare_unit]));
  const emojis = new Map(itemList.map((i) => [i.id, i.emoji]));
  const itemIdsByName = new Map(itemList.map((i) => [nameKey(i.name), i.id]));
  const storeNames = new Map(storeList.map((s) => [s.id, s.name]));

  // item → its latest price at each store it has one
  const latestByItem = new Map<string, LatestRow[]>();
  for (const row of z.array(latestRowSchema).parse(latest.data)) {
    latestByItem.set(row.item_id, [...(latestByItem.get(row.item_id) ?? []), row]);
  }

  const entries = z
    .array(listRowSchema)
    .parse(list.data)
    .map((row): ListEntry => {
      // Linked, or an item with the same name (added after the entry was typed).
      const itemId = itemIdFor({ itemId: row.item_id, name: row.name }, itemIdsByName);
      const unit = itemId ? units.get(itemId) : undefined;
      const prices = (itemId && latestByItem.get(itemId)) || [];
      const atStore = (name: string) => prices.find((p) => storeNames.get(p.store_id) === name);
      const newest = [...prices].sort((a, b) => b.observed_on.localeCompare(a.observed_on))[0];
      const start = atStore(LOG_STORES[0]) ?? newest;

      return {
        id: row.id,
        itemId,
        name: row.name,
        emoji: (itemId && emojis.get(itemId)) || null,
        photo: (itemId && photos.get(itemId)) || null,
        amount: formatAmount(row.quantity, row.unit),
        checked: row.checked,
        createdAt: row.created_at,
        unitLabel: unit ? compareUnitLabel(unit) : null,
        stores: unit
          ? mainStorePrices((name) => atStore(name)?.unit_price_base ?? null).map((s) => ({
              storeName: s.storeName,
              price: s.unitPrice === null ? null : formatUnitAmount(s.unitPrice, unit),
              cheapest: s.cheapest,
            }))
          : [],
        quickLog:
          itemId && unit
            ? {
                itemId,
                compareUnit: unit,
                price: start?.price ?? null,
                quantity: start?.package_quantity ?? null,
                unit: start?.package_unit ?? null,
                from: start ? (storeNames.get(start.store_id) ?? null) : null,
              }
            : null,
      };
    });

  return {
    entries: sortList(entries),
    stores: storeList,
    itemNames: itemList.map((i) => i.name),
  };
}
