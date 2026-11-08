import { describe, expect, it } from "vitest";
import {
  compareHere,
  MAIN_STORES,
  rankStores,
  storesForLogging,
  type StorePrice,
} from "./mainStores";

const at = (storeName: string, unitPrice: number | null): StorePrice => ({
  storeName,
  unitPrice,
  observedOn: unitPrice === null ? null : "2026-11-01",
});

describe("MAIN_STORES", () => {
  it("defaults to Trader Joe's, WinCo, Harmons", () => {
    expect(MAIN_STORES).toEqual(["Trader Joe's", "WinCo", "Harmons"]);
  });
});

describe("rankStores", () => {
  it("puts the cheapest first", () => {
    const ranked = rankStores([at("Trader Joe's", 3), at("WinCo", 1), at("Harmons", 2)]);
    expect(ranked.map((s) => s.storeName)).toEqual(["WinCo", "Harmons", "Trader Joe's"]);
  });

  it("puts stores with no price last, in the household's order", () => {
    const ranked = rankStores([at("Trader Joe's", null), at("WinCo", null), at("Harmons", 2)]);
    expect(ranked.map((s) => s.storeName)).toEqual(["Harmons", "Trader Joe's", "WinCo"]);
  });

  it("keeps the household's order for equal prices", () => {
    const ranked = rankStores([at("Trader Joe's", 1), at("WinCo", 1), at("Harmons", 1)]);
    expect(ranked.map((s) => s.storeName)).toEqual(["Trader Joe's", "WinCo", "Harmons"]);
  });

  it("doesn't change the list it was given", () => {
    const prices = [at("Trader Joe's", 3), at("WinCo", 1)];
    rankStores(prices);
    expect(prices[0]?.storeName).toBe("Trader Joe's");
  });
});

describe("compareHere", () => {
  const ranked = (...prices: [string, number | null][]) =>
    rankStores(prices.map(([name, price]) => at(name, price)));

  it("points to a cheaper main store, with how much less", () => {
    const c = compareHere(
      ranked(["Trader Joe's", 2.5], ["WinCo", 2], ["Harmons", null]),
      "Trader Joe's",
    );
    expect(c.here?.unitPrice).toBe(2.5);
    expect(c.cheaper).toMatchObject({ storeName: "WinCo", unitPrice: 2, percentLess: 20 });
    expect(c.cheapestHere).toBe(false);
  });

  it("says you're at the cheapest when nothing beats here", () => {
    const c = compareHere(ranked(["Trader Joe's", 2.5], ["WinCo", 2], ["Harmons", 3]), "WinCo");
    expect(c.cheaper).toBeNull();
    expect(c.cheapestHere).toBe(true);
  });

  it("counts a tie as cheapest here", () => {
    const c = compareHere(ranked(["Trader Joe's", 2], ["WinCo", 2]), "WinCo");
    expect(c.cheaper).toBeNull();
    expect(c.cheapestHere).toBe(true);
  });

  it("shows the cheapest known store when here has no price yet", () => {
    const c = compareHere(ranked(["Trader Joe's", null], ["WinCo", 2]), "Trader Joe's");
    expect(c.here).toBeNull();
    expect(c.cheaper).toMatchObject({ storeName: "WinCo", percentLess: 0 });
  });

  it("makes no claims with only one price, or none", () => {
    expect(compareHere(ranked(["WinCo", 2], ["Harmons", null]), "WinCo")).toMatchObject({
      cheaper: null,
      cheapestHere: false,
    });
    expect(compareHere(ranked(["WinCo", null]), "WinCo")).toEqual({
      here: null,
      cheaper: null,
      cheapestHere: false,
    });
  });

  it("works at a store that isn't one of the main three", () => {
    const c = compareHere(ranked(["WinCo", 2], ["Harmons", 3]), "Costco");
    expect(c.here).toBeNull();
    expect(c.cheaper?.storeName).toBe("WinCo");
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
