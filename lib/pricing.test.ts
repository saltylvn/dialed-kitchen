import { describe, expect, it } from "vitest";
import {
  compareToBest,
  daysBetween,
  formatMoney,
  formatPackage,
  formatUnitPrice,
  isOlder,
} from "./pricing";
import { pricePerBase } from "./units";

describe("compareToBest", () => {
  it("knows when there's nothing to compare to", () => {
    expect(compareToBest(1, null)).toEqual({ kind: "first" });
  });

  it("spots a new best price and by how much", () => {
    expect(compareToBest(1.6, 2)).toEqual({ kind: "new_best", percentBelow: 20 });
  });

  it("says how far above the best a price is", () => {
    expect(compareToBest(2.24, 2)).toEqual({ kind: "above_best", percentAbove: 12 });
  });

  it("treats tiny rounding differences as the same price", () => {
    expect(compareToBest(2.004, 2)).toEqual({ kind: "matches_best" });
    expect(compareToBest(1.996, 2)).toEqual({ kind: "matches_best" });
  });

  it("compares different package sizes by unit price", () => {
    const best = pricePerBase(6.49, 5, "lb");
    const now = pricePerBase(3.99, 2, "lb");
    expect(compareToBest(now, best)).toEqual({ kind: "above_best", percentAbove: 54 });
  });
});

describe("dates", () => {
  it("counts calendar days, across months and years", () => {
    expect(daysBetween("2026-10-01", "2026-10-23")).toBe(22);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2); // across the US clock change
  });

  it("marks best prices older than 90 days", () => {
    expect(isOlder("2026-07-25", "2026-10-23")).toBe(false); // exactly 90
    expect(isOlder("2026-07-24", "2026-10-23")).toBe(true); // 91
  });
});

describe("formatting", () => {
  it("formats money", () => {
    expect(formatMoney(3.5)).toBe("$3.50");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });

  it("formats unit prices in the item's unit", () => {
    expect(formatUnitPrice(pricePerBase(6.49, 5, "lb"), "lb")).toBe("$1.30/lb");
    expect(formatUnitPrice(pricePerBase(3.6, 1, "dozen"), "each")).toBe("$0.30 each");
    expect(formatUnitPrice(pricePerBase(4.39, 128, "fl_oz"), "fl_oz")).toBe("$0.034/fl oz");
    expect(formatUnitPrice(pricePerBase(3.84, 1, "gal"), "fl_oz")).toBe("$0.03/fl oz");
  });

  it("formats package sizes", () => {
    expect(formatPackage(5, "lb")).toBe("5 lb");
    expect(formatPackage(1.5, "gal")).toBe("1.5 gal");
    expect(formatPackage(0.3333333, "kg")).toBe("0.333 kg");
  });
});
