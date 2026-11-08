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

type Priced = StorePrice & { unitPrice: number };

export type HereComparison = {
  here: Priced | null; // the price last logged at the store you're in, if any
  cheaper: (Priced & { percentLess: number }) | null; // a main store that beats it
  cheapestHere: boolean; // you're at the cheapest of the stores with a price
};

// While shopping at `hereName`: its price, and the cheapest main store if that's somewhere
// else and cheaper (or here has no price yet). `ranked` comes from rankStores.
export function compareHere(ranked: readonly StorePrice[], hereName: string): HereComparison {
  const priced = ranked.filter((s): s is Priced => s.unitPrice !== null); // cheapest first
  const here = priced.find((s) => s.storeName === hereName) ?? null;
  const others = priced.filter((s) => s.storeName !== hereName);
  const bestOther = others[0] ?? null;

  if (!bestOther) return { here, cheaper: null, cheapestHere: false }; // nothing to compare
  if (here && here.unitPrice <= bestOther.unitPrice)
    return { here, cheaper: null, cheapestHere: true };

  const percentLess = here
    ? Math.round(((here.unitPrice - bestOther.unitPrice) / here.unitPrice) * 100)
    : 0;
  return { here, cheaper: { ...bestOther, percentLess }, cheapestHere: false };
}

// The stores on the price-logging wheel, top to bottom, in the owner's order. The first is
// where the wheel starts unless you're shopping somewhere (docs/decisions/0032).
export const LOG_STORES = ["Trader Joe's", "WinCo", "Harmons", "Smith's", "Walmart"] as const;

// The household's stores in wheel order. A store you're shopping at that isn't on the wheel
// (Costco) is added at the end, so a price logged there still has its store.
export function storesForLogging<S extends { id: string; name: string }>(
  stores: readonly S[],
  currentId: string | null = null,
): { wheel: S[]; start: S | null } {
  const wheel = LOG_STORES.flatMap((name) => stores.filter((s) => s.name === name));
  const current = stores.find((s) => s.id === currentId);
  if (current && !wheel.includes(current)) wheel.push(current);
  return { wheel, start: current ?? wheel[0] ?? null };
}
