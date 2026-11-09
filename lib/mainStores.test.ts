import { describe, expect, it } from "vitest";
import { MAIN_STORES, mainStorePrices, storesForLogging } from "./mainStores";

describe("MAIN_STORES", () => {
  it("is WinCo, Trader Joe's, Harmons, in that order", () => {
    expect(MAIN_STORES).toEqual(["WinCo", "Trader Joe's", "Harmons"]);
  });
});

describe("mainStorePrices", () => {
  const at = (prices: Record<string, number>) => (name: string) => prices[name] ?? null;

  it("keeps the fixed order and marks the cheapest", () => {
    const rows = mainStorePrices(at({ "Trader Joe's": 2.5, WinCo: 2, Harmons: 3 }));
    expect(rows).toEqual([
      { storeName: "WinCo", unitPrice: 2, cheapest: true },
      { storeName: "Trader Joe's", unitPrice: 2.5, cheapest: false },
      { storeName: "Harmons", unitPrice: 3, cheapest: false },
    ]);
  });

  it("marks every store that ties for cheapest", () => {
    const rows = mainStorePrices(at({ "Trader Joe's": 2, WinCo: 2 }));
    expect(rows.map((r) => r.cheapest)).toEqual([true, true, false]);
  });

  it("marks nothing with fewer than two prices", () => {
    expect(mainStorePrices(at({ WinCo: 2 })).some((r) => r.cheapest)).toBe(false);
    expect(mainStorePrices(at({})).every((r) => r.unitPrice === null && !r.cheapest)).toBe(true);
  });
});

describe("storesForLogging", () => {
  const stores = ["WinCo", "Trader Joe's", "Harmons", "Smith's", "Costco", "Walmart"].map(
    (name, i) => ({ id: `s${i}`, name }),
  );
  const names = (list: { name: string }[]) => list.map((s) => s.name);

  it("orders the wheel Trader Joe's, WinCo, Harmons, Smith's, Walmart and starts at Trader Joe's", () => {
    const { wheel, start } = storesForLogging(stores);
    expect(names(wheel)).toEqual(["Trader Joe's", "WinCo", "Harmons", "Smith's", "Walmart"]);
    expect(start?.name).toBe("Trader Joe's");
  });

  it("starts at the store you're shopping at", () => {
    expect(storesForLogging(stores, "s0").start?.name).toBe("WinCo");
  });

  it("adds a store you're at that isn't on the wheel, at the end", () => {
    const { wheel, start } = storesForLogging(stores, "s4");
    expect(names(wheel).at(-1)).toBe("Costco");
    expect(start?.name).toBe("Costco");
  });
});
