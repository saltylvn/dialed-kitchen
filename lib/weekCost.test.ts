import { describe, expect, it } from "vitest";
import { UNITS } from "./units";
import { rowDimension, weekCost, type PriceEstimate } from "./weekCost";
import type { ShoppingRow } from "./weekShopping";

const row = (over: Partial<ShoppingRow> & { name: string }): ShoppingRow => ({
  quantity: 1,
  unit: null,
  in_stock: false,
  on_list: false,
  est_cost: null,
  ...over,
});

const perLb = (dollars: number) => dollars / UNITS.lb.toBase;

describe("rowDimension", () => {
  it("is the unit's measure, a count for a bare number, null without an amount", () => {
    expect(rowDimension({ quantity: 2, unit: "lb" })).toBe("weight");
    expect(rowDimension({ quantity: 1, unit: "cup" })).toBe("volume");
    expect(rowDimension({ quantity: 3, unit: null })).toBe("count");
    expect(rowDimension({ quantity: null, unit: null })).toBeNull();
    expect(rowDimension({ quantity: 2, unit: "pinch" })).toBeNull();
  });
});

describe("weekCost", () => {
  const estimates: PriceEstimate[] = [
    { key: "ground beef", dimension: "weight", unitPriceBase: perLb(5) },
    { key: "onions", dimension: "count", unitPriceBase: 0.8 },
  ];

  it("keeps price-book costs and AI estimates apart, and skips what's In stock", () => {
    const cost = weekCost(
      [
        row({ name: "Rice", est_cost: 2.1 }),
        row({ name: "Ground beef, 80/20", quantity: 2, unit: "lb" }),
        row({ name: "Onions", quantity: 3 }),
        row({ name: "Milk", est_cost: 3.59, in_stock: true }),
      ],
      estimates,
    );
    expect(cost).toMatchObject({
      fromPrices: 2.1,
      fromEstimates: 12.4,
      total: 14.5,
      pricedCount: 1,
      estimatedCount: 2,
      unpriced: 0,
      toEstimate: [],
    });
  });

  it("lists what an estimate could cover, and counts what nothing can", () => {
    const cost = weekCost(
      [
        row({ name: "Cilantro (fresh)", quantity: 1 }),
        row({ name: "Flour", quantity: 2, unit: "cup" }),
        row({ name: "Salt", quantity: null }),
        // An estimate in another measure isn't used: no guessing cups from pounds.
        row({ name: "Ground beef", quantity: 1, unit: "cup" }),
      ],
      estimates,
    );
    expect(cost.total).toBeNull();
    expect(cost.unpriced).toBe(4);
    expect(cost.toEstimate).toEqual([
      { name: "Cilantro (fresh)", key: "cilantro", dimension: "count" },
      { name: "Flour", key: "flour", dimension: "volume" },
      { name: "Ground beef", key: "ground beef", dimension: "volume" },
    ]);
  });

  it("adds in cents", () => {
    const cost = weekCost(
      [row({ name: "A", est_cost: 0.1 }), row({ name: "B", est_cost: 0.2 })],
      [],
    );
    expect(cost.total).toBe(0.3);
  });
});
