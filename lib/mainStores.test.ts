import { describe, expect, it } from "vitest";
import { storesForLogging } from "./mainStores";

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
