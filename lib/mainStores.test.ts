import { describe, expect, it } from "vitest";
import { MAIN_STORES, rankStores, type StorePrice } from "./mainStores";

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
