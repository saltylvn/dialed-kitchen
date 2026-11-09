import { describe, expect, it } from "vitest";
import { parseQuantity } from "../features/prices/schema";
import { defaultSizeUnit, SIZE_FRACTIONS, sizeAmount, startingPrice } from "./packageSize";
import { pricePerBase } from "./units";

describe("sizeAmount", () => {
  it("adds the whole number and the fraction", () => {
    expect(sizeAmount(1, 0)).toBe("1");
    expect(sizeAmount(1, 3)).toBe("1.5"); // 1½
    expect(sizeAmount(2, 1)).toBe("2.25"); // 2¼
    expect(sizeAmount(0, 2)).toBe("0.333"); // ⅓
    expect(sizeAmount(16, 0)).toBe("16");
  });

  it("gives amounts the form accepts", () => {
    for (let whole = 0; whole <= 3; whole++) {
      for (let f = 0; f < SIZE_FRACTIONS.length; f++) {
        if (whole === 0 && f === 0) continue; // nothing: the form asks for a size
        expect(parseQuantity(sizeAmount(whole, f)), `${whole} ${f}`).toBeGreaterThan(0);
      }
    }
  });

  it("treats an unknown fraction as none", () => {
    expect(sizeAmount(3, 99)).toBe("3");
  });
});

describe("defaultSizeUnit", () => {
  it("starts at ounces for weight and drinks, each for counted things", () => {
    expect(defaultSizeUnit("weight")).toBe("oz");
    expect(defaultSizeUnit("volume")).toBe("fl_oz");
    expect(defaultSizeUnit("count")).toBe("each");
  });
});

describe("startingPrice", () => {
  it("is the last price for one of the default unit", () => {
    // $3.49 per lb → about $0.22 per oz
    expect(startingPrice(pricePerBase(3.49, 1, "lb"), "weight")).toBe(0.22);
    // a bag of 6 avocados for $5.99 → $1.00 each
    expect(startingPrice(pricePerBase(5.99, 6, "each"), "count")).toBe(1);
    // $3.29 a gallon → about $0.03 per fl oz
    expect(startingPrice(pricePerBase(3.29, 1, "gal"), "volume")).toBe(0.03);
  });

  it("starts at $1.00 with no price yet, and never at $0", () => {
    expect(startingPrice(null, "weight")).toBe(1);
    expect(startingPrice(pricePerBase(0.01, 100, "lb"), "weight")).toBe(0.01);
  });
});
