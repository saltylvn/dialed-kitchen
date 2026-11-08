import { describe, expect, it } from "vitest";
import { compareUnitFor, detectStore, receiptKey, suggestItem } from "./receipt";

const items = [
  { id: "eggs", name: "Organic eggs" },
  { id: "chicken", name: "Chicken thighs, boneless" },
  { id: "milk", name: "Whole milk" },
];

describe("receiptKey", () => {
  it("is the printed text in capitals with single spaces", () => {
    expect(receiptKey("  ks org   eggs 24ct ")).toBe("KS ORG EGGS 24CT");
  });

  it("drops the parts that change every trip: weight, multi-buy, price", () => {
    expect(receiptKey("ORGANIC BANANAS 1.32 lb @ 0.99/lb 1.31")).toBe("ORGANIC BANANAS");
    expect(receiptKey("organic bananas 0.98 LB @ $0.99 / lb 0.97")).toBe("ORGANIC BANANAS");
    expect(receiptKey("PASTA PENNE 16OZ 2 @ 1.29 2.58")).toBe("PASTA PENNE 16OZ");
    expect(receiptKey("YELLOW ONION 0.49")).toBe("YELLOW ONION");
    expect(receiptKey("KS ORG EGGS 24CT 6.99 F")).toBe("KS ORG EGGS 24CT");
  });

  it("keeps sizes that are part of the name", () => {
    expect(receiptKey("PASTA PENNE 16OZ")).toBe("PASTA PENNE 16OZ");
  });

  it("keeps at most 80 characters", () => {
    expect(receiptKey("x".repeat(100))).toHaveLength(80);
  });
});

describe("suggestItem", () => {
  it("prefers a match you made before for this receipt text", () => {
    const remembered = new Map([["KS ORG EGGS 24CT", "eggs"]]);
    expect(suggestItem({ text: "ks org eggs 24ct", name: "Milk" }, items, remembered)).toEqual({
      itemId: "eggs",
      how: "remembered",
    });
  });

  it("ignores a remembered item that no longer exists", () => {
    const remembered = new Map([["MYSTERY", "deleted-item"]]);
    expect(suggestItem({ text: "MYSTERY", name: "Mystery" }, items, remembered)).toBeNull();
  });

  it("matches the plain name, ignoring capitals", () => {
    expect(suggestItem({ text: "WHL MLK", name: "whole MILK" }, items, new Map())).toEqual({
      itemId: "milk",
      how: "name",
    });
  });

  it("matches the main part of a name", () => {
    expect(suggestItem({ text: "CHKN THGH", name: "Chicken thighs" }, items, new Map())).toEqual({
      itemId: "chicken",
      how: "name",
    });
  });

  it("matches when every word of your item is in the line's name", () => {
    const more = [
      ...items,
      { id: "avocado", name: "Avocado" },
      { id: "milkchoc", name: "Dark chocolate" },
    ];
    expect(
      suggestItem({ text: "X", name: "Boneless Chicken Thighs" }, more, new Map())?.itemId,
    ).toBe("chicken");
    expect(suggestItem({ text: "X", name: "Hass Avocados Bag" }, more, new Map())?.itemId).toBe(
      "avocado",
    );
  });

  it("doesn't match a different food that shares a word", () => {
    const milk = [{ id: "milk", name: "Milk" }];
    expect(suggestItem({ text: "X", name: "Milk chocolate" }, milk, new Map())).toBeNull();
  });

  it("prefers the most specific item", () => {
    const both = [
      { id: "onion", name: "Onion" },
      { id: "yellow", name: "Yellow onion" },
    ];
    expect(suggestItem({ text: "X", name: "Sweet yellow onion" }, both, new Map())?.itemId).toBe(
      "yellow",
    );
  });

  it("suggests nothing rather than guessing", () => {
    expect(suggestItem({ text: "TP 12PK", name: "Toilet paper" }, items, new Map())).toBeNull();
  });
});

describe("compareUnitFor", () => {
  it("compares weighed things per lb, liquids per fl oz, counted things each", () => {
    expect(compareUnitFor("oz")).toBe("lb");
    expect(compareUnitFor("gal")).toBe("fl_oz");
    expect(compareUnitFor("dozen")).toBe("each");
  });
});

describe("detectStore", () => {
  const stores = ["WinCo", "Trader Joe's", "Harmons", "Smith's", "Costco", "Walmart"].map(
    (name) => ({ name }),
  );

  it.each([
    ["TRADER JOE'S #123", "Trader Joe's"],
    ["WinCo Foods", "WinCo"],
    ["Harmons Neighborhood Grocer", "Harmons"],
    ["Smith's Food & Drug", "Smith's"],
    ["COSTCO WHOLESALE", "Costco"],
    ["Wal-Mart Supercenter", "Walmart"],
  ])("%s → %s", (printed, store) => {
    expect(detectStore(printed, stores)?.name).toBe(store);
  });

  it("is null when unsure", () => {
    expect(detectStore("Corner Market", stores)).toBeNull();
    expect(detectStore(null, stores)).toBeNull();
  });
});
