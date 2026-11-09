import "server-only";
import { z } from "zod";
import { formatAmount, sortList } from "@/lib/list";
import { itemIdFor, nameKey } from "@/lib/priceBook";
import { createClient } from "@/lib/server/supabase";
import type { Unit } from "@/lib/units";
import { readItemPhotos } from "@/features/prices/queries";
import { itemRowSchema } from "@/features/prices/schema";
import { listRowSchema } from "./schema";

// The Grocery page's list in one round trip of waiting: the list, the price book (to link
// each entry to its item) and photos, read in parallel. Prices aren't read here: they live
// in the price book (docs/decisions/0035).

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

  const [list, items, photos] = await Promise.all([
    supabase
      .from("grocery_list_items")
      .select("id, item_id, name, quantity, unit, checked, created_at"),
    supabase.from("items").select("id, name, compare_unit, emoji").order("name"),
    readItemPhotos(supabase),
  ]);
  if (list.error) fail("grocery_list_items", list.error);
  if (items.error) fail("items", items.error);

  const itemList = z.array(itemRowSchema).parse(items.data);
  const emojis = new Map(itemList.map((i) => [i.id, i.emoji]));
  const itemIdsByName = new Map(itemList.map((i) => [nameKey(i.name), i.id]));

  const entries = z
    .array(listRowSchema)
    .parse(list.data)
    .map((row): ListEntry => {
      // Linked, or an item with the same name (added after the entry was typed).
      const itemId = itemIdFor({ itemId: row.item_id, name: row.name }, itemIdsByName);
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
      };
    });

  return {
    // Oldest first, in the order things were added. (Entries ticked under the old Shopping
    // kart show here again: ticking now moves an item In stock instead.)
    entries: sortList(entries.map((e) => ({ ...e, checked: false }))),
    itemNames: itemList.map((i) => i.name),
  };
}
