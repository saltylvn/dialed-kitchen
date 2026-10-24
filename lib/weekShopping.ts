// Summing up what a week's meals need (rows from the database's week_shopping, decision
// 0019) for the Plan tab's groceries card.

export type ShoppingRow = {
  name: string;
  quantity: number | null;
  unit: string | null;
  in_stock: boolean;
  on_list: boolean;
  est_cost: number | null;
};

export type WeekSummary = {
  ingredients: number; // everything the week's meals use
  inStock: number;
  onList: number; // already on the grocery list, still to buy
  toAdd: number; // what "Add to grocery list" would add
  cost: number | null; // estimated cost of everything still to buy (not In stock)
  priced: number; // how many of those have a cost
  toBuy: number;
};

export function summarizeWeek(rows: readonly ShoppingRow[]): WeekSummary {
  const toBuy = rows.filter((r) => !r.in_stock);
  const costs = toBuy.map((r) => r.est_cost).filter((c): c is number => c !== null);
  return {
    ingredients: rows.length,
    inStock: rows.length - toBuy.length,
    onList: toBuy.filter((r) => r.on_list).length,
    toAdd: toBuy.filter((r) => !r.on_list).length,
    // Summed in cents, so $0.10 + $0.20 is exactly $0.30.
    cost: costs.length ? costs.reduce((sum, c) => sum + Math.round(c * 100), 0) / 100 : null,
    priced: costs.length,
    toBuy: toBuy.length,
  };
}
