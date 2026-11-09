// Matching grocery-list entries to price-book items by name. Pure logic, unit tested.

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
