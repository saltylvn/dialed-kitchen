import "server-only";
import { z } from "zod";
import { formatShortDate, serverToday } from "@/lib/dates";
import { formatAmount, sortList } from "@/lib/list";
import { formatUnitPrice } from "@/lib/pricing";
import { createClient } from "@/lib/server/supabase";
import { itemRowSchema, storeRowSchema, type StoreRow } from "@/features/prices/schema";
import { listRowSchema } from "./schema";

// The list screen in one round trip of waiting: the list, the price book, best prices,
// stores and (if a store is chosen) the last price there, all read in parallel. Prices are
// turned into display text here, so the browser only gets what it shows.

export type ListEntry = {
  id: string;
  itemId: string | null;
  name: string;
  amount: string;
  checked: boolean;
  createdAt: string;
  best: string | null; // "$1.30/lb · Aldi"
  here: string | null; // "$1.50/lb · Oct 3": the last price at the chosen store
};

export type ListPage = {
  entries: ListEntry[];
  stores: StoreRow[];
  store: StoreRow | null;
  itemNames: string[]; // the price book, for suggestions when adding
};

const latestRowSchema = z.object({
  item_id: z.uuid(),
  observed_on: z.string(),
  unit_price_base: z.coerce.number(),
});

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export async function getListPage(storeParam: string | undefined): Promise<ListPage> {
  const storeId = z.uuid().safeParse(storeParam).success ? storeParam! : null;
  const supabase = await createClient();

  const [list, items, best, stores, here] = await Promise.all([
    supabase
      .from("grocery_list_items")
      .select("id, item_id, name, quantity, unit, checked, created_at"),
    supabase.from("items").select("id, name, compare_unit").order("name"),
    supabase.from("item_best_prices").select("item_id, store_id, unit_price_base"),
    supabase.from("stores").select("id, name").order("sort_order"),
    storeId
      ? supabase
          .from("item_latest_store_prices")
          .select("item_id, observed_on, unit_price_base")
          .eq("store_id", storeId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (list.error) fail("grocery_list_items", list.error);
  if (items.error) fail("items", items.error);
  if (best.error) fail("item_best_prices", best.error);
  if (stores.error) fail("stores", stores.error);
  if (here.error) fail("item_latest_store_prices", here.error);

  const itemList = z.array(itemRowSchema).parse(items.data);
  const storeList = z.array(storeRowSchema).parse(stores.data);
  const units = new Map(itemList.map((i) => [i.id, i.compare_unit]));
  const storeNames = new Map(storeList.map((s) => [s.id, s.name]));
  const bestByItem = new Map(
    z
      .array(
        z.object({ item_id: z.uuid(), store_id: z.uuid(), unit_price_base: z.coerce.number() }),
      )
      .parse(best.data)
      .map((b) => [b.item_id, b]),
  );
  const hereByItem = new Map(
    z
      .array(latestRowSchema)
      .parse(here.data)
      .map((h) => [h.item_id, h]),
  );
  const year = Number(serverToday().slice(0, 4));

  const entries = z
    .array(listRowSchema)
    .parse(list.data)
    .map((row): ListEntry => {
      const unit = row.item_id ? units.get(row.item_id) : undefined;
      const b = row.item_id ? bestByItem.get(row.item_id) : undefined;
      const h = row.item_id ? hereByItem.get(row.item_id) : undefined;
      return {
        id: row.id,
        itemId: row.item_id,
        name: row.name,
        amount: formatAmount(row.quantity, row.unit),
        checked: row.checked,
        createdAt: row.created_at,
        best:
          unit && b
            ? `${formatUnitPrice(b.unit_price_base, unit)} · ${storeNames.get(b.store_id) ?? ""}`
            : null,
        here:
          unit && h
            ? `${formatUnitPrice(h.unit_price_base, unit)} · ${formatShortDate(h.observed_on, year)}`
            : null,
      };
    });

  return {
    entries: sortList(entries),
    stores: storeList,
    store: storeList.find((s) => s.id === storeId) ?? null,
    itemNames: itemList.map((i) => i.name),
  };
}
