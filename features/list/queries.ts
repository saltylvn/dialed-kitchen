import "server-only";
import { z } from "zod";
import { formatAmount, sortList } from "@/lib/list";
import { itemIdFor, nameKey } from "@/lib/priceBook";
import { isOlder, formatUnitPrice } from "@/lib/pricing";
import { estimateCost, type CheapestNow } from "@/lib/shopTrip";
import { serverToday } from "@/lib/dates";
import { createClient } from "@/lib/server/db";
import { isUnit, UNITS, type Unit } from "@/lib/units";
import { itemRowSchema, storeRowSchema } from "@/features/prices/schema";
import { listRowSchema } from "./schema";

// The Grocery page's list in one round trip of waiting: the list, the price book (to link
// each entry to its item) and where each item is cheapest now (each store's latest price,
// then the lowest; docs/decisions/0052), read in parallel. The full prices live in the
// price book (docs/decisions/0035).

export type ListEntry = {
  id: string;
  itemId: string | null; // the price-book item, for the Price book button
  name: string;
  amount: string; // "2 lb", or ""
  quantity: number | null; // the raw amount, to put it back on Undo
  unit: Unit | null;
  createdAt: string;
  // Where it's cheapest now, for context while shopping; null when never priced.
  best: { price: string; store: string; older: boolean } | null;
  cheapest: CheapestNow | null; // the same, as numbers, for the By store view
  estCost: number | null; // this entry's amount at that price, when it converts
};

export type ListPage = {
  entries: ListEntry[];
  storeOrder: string[]; // store ids in the fixed order (docs/decisions/0012)
  itemNames: string[]; // the price book, for suggestions when adding
};

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export async function getListPage(): Promise<ListPage> {
  const db = await createClient();

  const [list, items, best, stores] = await Promise.all([
    db.from("grocery_list_items").select("id, item_id, name, quantity, unit, checked, created_at"),
    db.from("items").select("id, name, compare_unit").order("name"),
    // Cheapest now per item (computed by the database, decision 0052).
    db
      .from("item_cheapest_now")
      .select("item_id, store_id, unit_price_base, package_unit, observed_on"),
    db.from("stores").select("id, name").order("sort_order"),
  ]);
  if (list.error) fail("grocery_list_items", list.error);
  if (items.error) fail("items", items.error);
  if (best.error) fail("item_cheapest_now", best.error);
  if (stores.error) fail("stores", stores.error);

  const itemList = z.array(itemRowSchema).parse(items.data);
  const units = new Map(itemList.map((i) => [i.id, i.compare_unit]));
  const storeList = z.array(storeRowSchema).parse(stores.data);
  const storeNames = new Map(storeList.map((st) => [st.id, st.name]));
  const bestByItem = new Map(
    z
      .array(
        z.object({
          item_id: z.uuid(),
          store_id: z.uuid(),
          unit_price_base: z.coerce.number(),
          package_unit: z.string().refine(isUnit),
          observed_on: z.string(),
        }),
      )
      .parse(best.data)
      .map((b) => [b.item_id, b]),
  );
  const today = serverToday();
  const itemIdsByName = new Map(itemList.map((i) => [nameKey(i.name), i.id]));

  const entries = z
    .array(listRowSchema)
    .parse(list.data)
    .map((row): ListEntry => {
      // Linked, or an item with the same name (added after the entry was typed).
      const itemId = itemIdFor({ itemId: row.item_id, name: row.name }, itemIdsByName);
      const b = itemId ? bestByItem.get(itemId) : undefined;
      const unit = itemId ? units.get(itemId) : undefined;
      const cheapest: CheapestNow | null =
        b && isUnit(b.package_unit)
          ? {
              storeId: b.store_id,
              store: storeNames.get(b.store_id) ?? "",
              unitPriceBase: b.unit_price_base,
              dimension: UNITS[b.package_unit].dimension,
            }
          : null;
      return {
        id: row.id,
        itemId,
        name: row.name,
        amount: formatAmount(row.quantity, row.unit),
        quantity: row.quantity,
        unit: row.unit,
        createdAt: row.created_at,
        best:
          b && unit
            ? {
                price: formatUnitPrice(b.unit_price_base, unit),
                store: storeNames.get(b.store_id) ?? "",
                older: isOlder(b.observed_on, today),
              }
            : null,
        cheapest,
        estCost: estimateCost(row.quantity, row.unit, cheapest),
      };
    });

  return {
    // Oldest first, in the order things were added. (Entries ticked under the old Shopping
    // kart show here again: ticking now moves an item In stock instead.)
    entries: sortList(entries.map((e) => ({ ...e, checked: false }))),
    storeOrder: storeList.map((st) => st.id),
    itemNames: itemList.map((i) => i.name),
  };
}
