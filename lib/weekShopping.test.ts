import { describe, expect, it } from "vitest";
import { summarizeWeek, type ShoppingRow } from "./weekShopping";

const row = (over: Partial<ShoppingRow>): ShoppingRow => ({
  name: "x",
  quantity: 1,
  unit: null,
  in_stock: false,
  on_list: false,
  est_cost: null,
  ...over,
});

describe("summarizeWeek", () => {
  it("counts what's needed, In stock and on the list, and totals the cost to buy", () => {
    expect(
      summarizeWeek([
        row({ est_cost: 0.1 }),
        row({ est_cost: 0.2 }),
        row({ on_list: true, est_cost: 6 }),
        row({ in_stock: true, est_cost: 99 }), // In stock: not bought, not costed
        row({}),
      ]),
    ).toEqual({ ingredients: 5, inStock: 1, onList: 1, toAdd: 3, cost: 6.3, priced: 3, toBuy: 4 });
  });

  it("has no cost when nothing has a price, and nothing to add when empty", () => {
    expect(summarizeWeek([row({})]).cost).toBeNull();
    expect(summarizeWeek([])).toEqual({
      ingredients: 0,
      inStock: 0,
      onList: 0,
      toAdd: 0,
      cost: null,
      priced: 0,
      toBuy: 0,
    });
  });
});
