// The stores the household shops at most, shown next to every item with the price last
// logged at each (docs/decisions/0034). Pure logic, unit tested.

// Always shown in this order, top to bottom, so each store is in the same place on every
// row and easy to find while shopping. Names match the fixed store list (decision 0012).
export const MAIN_STORES = ["WinCo", "Trader Joe's", "Harmons"] as const;

export type StorePrice = {
  storeName: string;
  unitPrice: number | null; // price per gram, ml or item; null = nothing logged there yet
};

// The main stores in their fixed order, each with its last logged price (if any) and
// whether it's the cheapest of them. Ties are all marked; with fewer than two prices
// there's nothing to compare, so nothing is marked.
export function mainStorePrices(
  priceAt: (storeName: string) => number | null,
): (StorePrice & { cheapest: boolean })[] {
  const prices = MAIN_STORES.map((storeName) => ({ storeName, unitPrice: priceAt(storeName) }));
  const known = prices.flatMap((p) => (p.unitPrice === null ? [] : [p.unitPrice]));
  const lowest = known.length >= 2 ? Math.min(...known) : null;
  return prices.map((p) => ({ ...p, cheapest: lowest !== null && p.unitPrice === lowest }));
}

// The stores on the price-logging wheel, top to bottom, in the owner's order. The first is
// where the wheel starts unless told otherwise (docs/decisions/0032).
export const LOG_STORES = ["Trader Joe's", "WinCo", "Harmons", "Smith's", "Walmart"] as const;

// The household's stores in wheel order. A starting store that isn't on the wheel (Costco)
// is added at the end, so a price logged there still has its store.
export function storesForLogging<S extends { id: string; name: string }>(
  stores: readonly S[],
  currentId: string | null = null,
): { wheel: S[]; start: S | null } {
  const wheel = LOG_STORES.flatMap((name) => stores.filter((s) => s.name === name));
  const current = stores.find((s) => s.id === currentId);
  if (current && !wheel.includes(current)) wheel.push(current);
  return { wheel, start: current ?? wheel[0] ?? null };
}
