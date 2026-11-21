import { describe, expect, it } from "vitest";
import { estimateCost, groupByStore, type CheapestNow } from "./shopTrip";
import { UNITS } from "./units";

const perLb = (dollars: number) => dollars / UNITS.lb.toBase;
const winco: CheapestNow = {
  storeId: "w",
  store: "WinCo",
  unitPriceBase: perLb(2),
  dimension: "weight",
};
const costco: CheapestNow = {
  storeId: "c",
  store: "Costco",
  unitPriceBase: 0.5,
  dimension: "count",
};

describe("estimateCost", () => {
  it("converts the amount to the price's unit", () => {
    expect(estimateCost(2, "lb", winco)).toBe(4);
    expect(estimateCost(8, "oz", winco)).toBe(1);
  });

  it("treats a bare number as a count", () => {
    expect(estimateCost(3, null, costco)).toBe(1.5);
    expect(estimateCost(1, "dozen", costco)).toBe(6);
  });

  it("refuses to guess across measures, or without an amount or price", () => {
    expect(estimateCost(2, "cup", winco)).toBeNull();
    expect(estimateCost(3, null, winco)).toBeNull();
    expect(estimateCost(null, "lb", winco)).toBeNull();
    expect(estimateCost(2, "lb", null)).toBeNull();
  });
});

describe("groupByStore", () => {
  it("groups by cheapest store in store order, with subtotals, unpriced last", () => {
    const groups = groupByStore(
      [
        { name: "Rice", cheapest: winco, estCost: 4 },
        { name: "Salt", cheapest: null, estCost: null },
        { name: "Eggs", cheapest: costco, estCost: 6 },
        { name: "Beans", cheapest: winco, estCost: null },
        { name: "Oats", cheapest: winco, estCost: 2.5 },
      ],
      ["c", "w"],
    );
    expect(
      groups.map((g) => ({
        label: g.label,
        names: g.entries.map((e) => e.name),
        subtotal: g.subtotal,
        unpriced: g.unpriced,
      })),
    ).toEqual([
      { label: "Costco", names: ["Eggs"], subtotal: 6, unpriced: 0 },
      { label: "WinCo", names: ["Rice", "Beans", "Oats"], subtotal: 6.5, unpriced: 1 },
      { label: "Anywhere", names: ["Salt"], subtotal: 0, unpriced: 1 },
    ]);
  });
});
