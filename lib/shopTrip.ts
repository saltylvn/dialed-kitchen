import { UNITS, type Dimension, type Unit } from "./units";

// Planning a shopping trip (docs/decisions/0052): what an entry on the list should cost at
// the cheapest store now, and the list split by store. Pure functions, no I/O.

export type CheapestNow = {
  storeId: string;
  store: string;
  unitPriceBase: number; // price per gram, millilitre or item
  dimension: Dimension; // what that price measures
};

// The cost of `quantity` `unit` at that price, or null when it can't be worked out honestly:
// no amount, or an amount that measures something else (cups of an item priced each).
// A bare number ("2" avocados) is a count.
export function estimateCost(
  quantity: number | null,
  unit: Unit | null,
  cheapest: CheapestNow | null,
): number | null {
  if (cheapest === null || quantity === null || !(quantity > 0)) return null;
  if (unit === null) {
    return cheapest.dimension === "count" ? round2(quantity * cheapest.unitPriceBase) : null;
  }
  if (UNITS[unit].dimension !== cheapest.dimension) return null;
  return round2(quantity * UNITS[unit].toBase * cheapest.unitPriceBase);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type StoreGroup<T> = {
  storeId: string | null; // null: not priced anywhere yet
  label: string;
  entries: T[];
  subtotal: number; // of the entries with an estimate
  unpriced: number; // entries without one
};

// The list split by where each thing is cheapest now, stores in their fixed order, then
// "Anywhere" for things without a price.
export function groupByStore<T extends { cheapest: CheapestNow | null; estCost: number | null }>(
  entries: readonly T[],
  storeOrder: readonly string[], // store ids
): StoreGroup<T>[] {
  const groups = new Map<string | null, StoreGroup<T>>();
  for (const e of entries) {
    const id = e.cheapest?.storeId ?? null;
    let group = groups.get(id);
    if (!group) {
      group = {
        storeId: id,
        label: e.cheapest?.store ?? "Anywhere",
        entries: [],
        subtotal: 0,
        unpriced: 0,
      };
      groups.set(id, group);
    }
    group.entries.push(e);
    if (e.estCost === null) group.unpriced++;
    else group.subtotal = round2(group.subtotal + e.estCost);
  }
  const rank = (id: string | null) => {
    if (id === null) return Number.MAX_SAFE_INTEGER;
    const i = storeOrder.indexOf(id);
    return i === -1 ? storeOrder.length : i;
  };
  return [...groups.values()].sort((a, b) => rank(a.storeId) - rank(b.storeId));
}
