// The stores the household shops at most, shown on every Price Tracker row with the price
// last logged at each, cheapest first (docs/decisions/0031). Pure logic, unit tested.

// The default three, in the owner's order. Names match the fixed store list (decision 0012).
export const MAIN_STORES = ["Trader Joe's", "WinCo", "Harmons"] as const;

export type StorePrice = {
  storeName: string;
  unitPrice: number | null; // price per gram, ml or item; null = nothing logged there yet
  observedOn: string | null;
};

// Cheapest first. Stores with no price go last, in the household's order, so the box always
// lists all three in a stable way. Equal prices keep the household's order too.
export function rankStores(prices: readonly StorePrice[]): StorePrice[] {
  return prices
    .map((p, order) => ({ p, order }))
    .sort((a, b) => {
      const x = a.p.unitPrice;
      const y = b.p.unitPrice;
      if (x === null || y === null) {
        if (x !== y) return x === null ? 1 : -1;
      } else if (x !== y) {
        return x - y;
      }
      return a.order - b.order;
    })
    .map(({ p }) => p);
}
