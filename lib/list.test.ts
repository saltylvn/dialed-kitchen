import { describe, expect, it } from "vitest";
import { formatAmount, sortList } from "./list";

describe("sortList", () => {
  it("puts things still to buy first, in the order they were added, then checked ones by name", () => {
    const items = [
      { name: "milk", checked: true, createdAt: "2026-10-01T00:00:01Z" },
      { name: "Rice", checked: false, createdAt: "2026-10-01T00:00:03Z" },
      { name: "Apples", checked: true, createdAt: "2026-10-01T00:00:04Z" },
      { name: "Eggs", checked: false, createdAt: "2026-10-01T00:00:02Z" },
    ];
    expect(sortList(items).map((i) => i.name)).toEqual(["Eggs", "Rice", "Apples", "milk"]);
  });

  it("doesn't change the list it was given", () => {
    const items = [
      { name: "B", checked: true, createdAt: "2" },
      { name: "A", checked: false, createdAt: "1" },
    ];
    sortList(items);
    expect(items[0]!.name).toBe("B");
  });
});

describe("formatAmount", () => {
  it("shows amounts with or without units", () => {
    expect(formatAmount(2, "lb")).toBe("2 lb");
    expect(formatAmount(1.5, "gal")).toBe("1.5 gal");
    expect(formatAmount(3, null)).toBe("3");
    expect(formatAmount(1, "dozen")).toBe("1 dozen");
    expect(formatAmount(null, null)).toBe("");
  });
});
