import { matchKey } from "./ingredients";
import { estimateCost } from "./shopTrip";
import { UNITS, type Dimension, type Unit } from "./units";
import type { ShoppingRow } from "./weekShopping";

// The week's grocery cost (docs/decisions/0057): what the planned meals still need (not In
// stock), priced from the price book first (week_shopping's est_cost, cheapest now), then
// from saved AI estimates, always kept apart so the screen can label the estimate "~".
// Pure: no I/O, no guessing across measures.

export type PriceEstimate = { key: string; dimension: Dimension; unitPriceBase: number };

export type NeedsEstimate = { name: string; key: string; dimension: Dimension };

export type WeekCost = {
  fromPrices: number; // dollars, from the price book
  fromEstimates: number; // dollars, from AI estimates
  total: number | null; // both, or null when nothing is priced at all
  pricedCount: number;
  estimatedCount: number;
  unpriced: number; // still to buy with no price and no estimate
  toEstimate: NeedsEstimate[]; // the unpriced ones an estimate could cover
};

function asUnit(unit: string | null): Unit | null | undefined {
  if (unit === null) return null;
  return unit in UNITS ? (unit as Unit) : undefined; // undefined: a unit we don't know
}

// What a row's amount measures: its unit's measure, a count for a bare number, or null
// when it has no amount ("salt to taste") or a unit we don't know.
export function rowDimension(row: Pick<ShoppingRow, "quantity" | "unit">): Dimension | null {
  if (row.quantity === null || !(row.quantity > 0)) return null;
  const unit = asUnit(row.unit);
  if (unit === undefined) return null;
  return unit === null ? "count" : UNITS[unit].dimension;
}

export function weekCost(
  rows: readonly ShoppingRow[],
  estimates: readonly PriceEstimate[],
): WeekCost {
  const byKey = new Map(estimates.map((e) => [`${e.key}|${e.dimension}`, e]));
  let pricesCents = 0;
  let estimatesCents = 0;
  let pricedCount = 0;
  let estimatedCount = 0;
  const toEstimate: NeedsEstimate[] = [];
  let unpriced = 0;

  for (const row of rows) {
    if (row.in_stock) continue;
    if (row.est_cost !== null) {
      pricesCents += Math.round(row.est_cost * 100);
      pricedCount += 1;
      continue;
    }
    const dimension = rowDimension(row);
    const key = matchKey(row.name);
    const estimate = dimension ? byKey.get(`${key}|${dimension}`) : undefined;
    const unit = asUnit(row.unit);
    const cost =
      estimate && unit !== undefined
        ? estimateCost(row.quantity, unit, { storeId: "", store: "", ...estimate })
        : null;
    if (cost !== null) {
      estimatesCents += Math.round(cost * 100);
      estimatedCount += 1;
      continue;
    }
    unpriced += 1;
    if (dimension && key) toEstimate.push({ name: row.name, key, dimension });
  }

  const any = pricedCount + estimatedCount > 0;
  return {
    fromPrices: pricesCents / 100,
    fromEstimates: estimatesCents / 100,
    total: any ? (pricesCents + estimatesCents) / 100 : null,
    pricedCount,
    estimatedCount,
    unpriced,
    toEstimate,
  };
}
