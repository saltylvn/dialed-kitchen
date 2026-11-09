import { describe, expect, it } from "vitest";
import { itemIdFor, nameKey } from "./priceBook";

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
