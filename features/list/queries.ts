import "server-only";
import { z } from "zod";
import { formatAmount, sortList } from "@/lib/list";
import { itemIdFor, nameKey } from "@/lib/priceBook";
import { formatUnitPrice } from "@/lib/pricing";
import { createClient } from "@/lib/server/supabase";
import type { Unit } from "@/lib/units";
import { readItemPhotos } from "@/features/prices/queries";
import { itemRowSchema, storeRowSchema } from "@/features/prices/schema";
import { listRowSchema } from "./schema";

// The Grocery page's list in one round trip of waiting: the list, the price book (to link
// each entry to its item), photos, and each item's best price so far with its store, read
// in parallel. The full prices live in the price book (docs/decisions/0035).

export type ListEntry = {
  id: string;
  itemId: string | null; // the price-book item, for the Price book button
  name: string;
  emoji: string | null; // the item's custom emoji, if one was chosen
  photo: string | null; // the item's photo address, if it has one
  amount: string; // "2 lb", or ""
  quantity: number | null; // the raw amount, to put it back on Undo
  unit: Unit | null;
  createdAt: string;
  best: { price: string; store: string } | null; // the best price so far, for context
};

export type ListPage = {
  entries: ListEntry[];
  itemNames: string[]; // the price book, for suggestions when adding
};

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export async function getListPage(): Promise<ListPage> {
  const supabase = await createClient();

  const [list, items, photos, best, stores] = await Promise.all([
    supabase
      .from("grocery_list_items")
      .select("id, item_id, name, quantity, unit, checked, created_at"),
    supabase.from("items").select("id, name, compare_unit, emoji").order("name"),
    readItemPhotos(supabase),
    // The best price so far per item (computed by the database, decision 0003).
    supabase.from("item_best_prices").select("item_id, store_id, unit_price_base"),
    supabase.from("stores").select("id, name"),
  ]);
  if (list.error) fail("grocery_list_items", list.error);
  if (items.error) fail("items", items.error);
  if (best.error) fail("item_best_prices", best.error);
  if (stores.error) fail("stores", stores.error);

  const itemList = z.array(itemRowSchema).parse(items.data);
  const emojis = new Map(itemList.map((i) => [i.id, i.emoji]));
  const units = new Map(itemList.map((i) => [i.id, i.compare_unit]));
  const storeNames = new Map(
    z
      .array(storeRowSchema)
      .parse(stores.data)
      .map((st) => [st.id, st.name]),
  );
  const bestByItem = new Map(
    z
      .array(
        z.object({ item_id: z.uuid(), store_id: z.uuid(), unit_price_base: z.coerce.number() }),
      )
      .parse(best.data)
      .map((b) => [b.item_id, b]),
  );
  const itemIdsByName = new Map(itemList.map((i) => [nameKey(i.name), i.id]));

  const entries = z
    .array(listRowSchema)
    .parse(list.data)
    .map((row): ListEntry => {
      // Linked, or an item with the same name (added after the entry was typed).
      const itemId = itemIdFor({ itemId: row.item_id, name: row.name }, itemIdsByName);
      const b = itemId ? bestByItem.get(itemId) : undefined;
      const unit = itemId ? units.get(itemId) : undefined;
      return {
        id: row.id,
        itemId,
        name: row.name,
        emoji: (itemId && emojis.get(itemId)) || null,
        photo: (itemId && photos.get(itemId)) || null,
        amount: formatAmount(row.quantity, row.unit),
        quantity: row.quantity,
        unit: row.unit,
        createdAt: row.created_at,
        best:
          b && unit
            ? {
                price: formatUnitPrice(b.unit_price_base, unit),
                store: storeNames.get(b.store_id) ?? "",
              }
            : null,
      };
    });

  return {
    // Oldest first, in the order things were added. (Entries ticked under the old Shopping
    // kart show here again: ticking now moves an item In stock instead.)
    entries: sortList(entries.map((e) => ({ ...e, checked: false }))),
    itemNames: itemList.map((i) => i.name),
  };
}
