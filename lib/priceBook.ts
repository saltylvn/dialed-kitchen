// The Prices view: what's on the grocery list first, then the rest of the price book.
// Pure logic (no I/O), so it's unit tested.

// The key a list entry and a price-book item are matched on: the name, ignoring capitals
// and extra spaces (the same rule addToList uses when it links a new entry).
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// The price-book item a list entry is for: its link if it has one, otherwise an item with
// the same name. An entry typed before its item was added stays unlinked in the database,
// so the name match lets it pick up the item's prices once the item exists.
export function itemIdFor(
  entry: { itemId: string | null; name: string },
  itemIdsByName: ReadonlyMap<string, string>,
): string | null {
  return entry.itemId ?? itemIdsByName.get(nameKey(entry.name)) ?? null;
}

export type PriceBookRow<I, E> = { entry: E; item: I | null };

// Splits the price book in two: every list entry (in list order) with its item, if any,
// then the items that aren't on the list. Each item and each unlinked name shows once,
// even if it's on the list twice (say, once checked and once still to buy).
export function splitPriceBook<
  I extends { id: string; name: string },
  E extends { itemId: string | null; name: string },
>(items: readonly I[], entries: readonly E[]): { onList: PriceBookRow<I, E>[]; others: I[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const idsByName = new Map(items.map((i) => [nameKey(i.name), i.id]));

  const seen = new Set<string>();
  const onList: PriceBookRow<I, E>[] = [];
  for (const entry of entries) {
    const id = itemIdFor(entry, idsByName);
    const item = id ? (byId.get(id) ?? null) : null;
    const key = item ? `item:${item.id}` : `name:${nameKey(entry.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    onList.push({ entry, item });
  }

  const others = items.filter((i) => !seen.has(`item:${i.id}`));
  return { onList, others };
}
