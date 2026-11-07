import { describe, expect, it } from "vitest";
import { itemIdFor, nameKey, splitPriceBook } from "./priceBook";

const eggs = { id: "i-eggs", name: "Eggs" };
const milk = { id: "i-milk", name: "Whole milk" };
const rice = { id: "i-rice", name: "Rice" };
const items = [eggs, rice, milk];

describe("nameKey", () => {
  it("ignores capitals and extra spaces", () => {
    expect(nameKey("  Whole   MILK ")).toBe("whole milk");
  });
});

describe("itemIdFor", () => {
  const byName = new Map([["eggs", "i-eggs"]]);

  it("uses the entry's link first", () => {
    expect(itemIdFor({ itemId: "i-rice", name: "Eggs" }, byName)).toBe("i-rice");
  });

  it("falls back to an item with the same name", () => {
    expect(itemIdFor({ itemId: null, name: "EGGS" }, byName)).toBe("i-eggs");
  });

  it("is null when nothing matches", () => {
    expect(itemIdFor({ itemId: null, name: "Saffron" }, byName)).toBeNull();
  });
});

describe("splitPriceBook", () => {
  it("puts list entries first, in list order, then the other items", () => {
    const entries = [
      { itemId: "i-milk", name: "Whole milk" },
      { itemId: null, name: "Saffron" },
    ];
    const { onList, others } = splitPriceBook(items, entries);
    expect(onList.map((r) => [r.entry.name, r.item?.id ?? null])).toEqual([
      ["Whole milk", "i-milk"],
      ["Saffron", null],
    ]);
    expect(others).toEqual([eggs, rice]);
  });

  it("links an unlinked entry to an item with the same name", () => {
    const { onList, others } = splitPriceBook(items, [{ itemId: null, name: "rice" }]);
    expect(onList[0]?.item).toBe(rice);
    expect(others).not.toContain(rice);
  });

  it("shows an item once even if it's on the list twice", () => {
    const entries = [
      { itemId: "i-eggs", name: "Eggs" },
      { itemId: null, name: "eggs" },
      { itemId: null, name: "Saffron" },
      { itemId: null, name: "SAFFRON" },
    ];
    const { onList } = splitPriceBook(items, entries);
    expect(onList.map((r) => r.entry.name)).toEqual(["Eggs", "Saffron"]);
  });

  it("keeps an entry whose item was deleted as plain text", () => {
    const { onList } = splitPriceBook(items, [{ itemId: "i-gone", name: "Gone" }]);
    expect(onList[0]?.item).toBeNull();
  });
});
