import { describe, expect, it } from "vitest";
import { isUnit, pricePerBase, pricePerUnit, sameDimension, UNITS, unitsFor } from "./units";

describe("units", () => {
  it("groups units by dimension", () => {
    expect(unitsFor("weight")).toEqual(["oz", "lb", "g", "kg"]);
    expect(unitsFor("volume")).toEqual(["fl_oz", "tsp", "tbsp", "cup", "qt", "gal", "ml", "l"]);
    expect(unitsFor("count")).toEqual(["each", "dozen"]);
  });

  it("uses exact conversion factors", () => {
    expect(UNITS.lb.toBase / UNITS.oz.toBase).toBeCloseTo(16, 10);
    expect(UNITS.gal.toBase / UNITS.fl_oz.toBase).toBeCloseTo(128, 10);
    expect(UNITS.qt.toBase / UNITS.fl_oz.toBase).toBeCloseTo(32, 10);
    expect(UNITS.cup.toBase / UNITS.fl_oz.toBase).toBeCloseTo(8, 10);
    expect(UNITS.cup.toBase / UNITS.tbsp.toBase).toBeCloseTo(16, 10);
    expect(UNITS.tbsp.toBase / UNITS.tsp.toBase).toBeCloseTo(3, 10);
  });

  it("never converts between dimensions", () => {
    expect(sameDimension("lb", "oz")).toBe(true);
    expect(sameDimension("lb", "fl_oz")).toBe(false);
    expect(sameDimension("each", "g")).toBe(false);
  });

  it("recognizes only known units", () => {
    expect(isUnit("lb")).toBe(true);
    expect(isUnit("pint")).toBe(false);
    expect(isUnit("toString")).toBe(false); // not fooled by object built-ins
  });
});

describe("unit prices", () => {
  it("compares different package sizes fairly", () => {
    const bigBag = pricePerUnit(pricePerBase(6.49, 5, "lb"), "lb"); // $1.298/lb
    const smallBag = pricePerUnit(pricePerBase(3.99, 2, "lb"), "lb"); // $1.995/lb
    expect(bigBag).toBeCloseTo(1.298, 10);
    expect(smallBag).toBeCloseTo(1.995, 10);
    expect(bigBag).toBeLessThan(smallBag);
  });

  it("converts between units of the same dimension", () => {
    // 16 oz for $4 is $4/lb
    expect(pricePerUnit(pricePerBase(4, 16, "oz"), "lb")).toBeCloseTo(4, 10);
    // a gallon for $3.84 is 3 cents per fl oz
    expect(pricePerUnit(pricePerBase(3.84, 1, "gal"), "fl_oz")).toBeCloseTo(0.03, 10);
    // a dozen eggs for $3.60 is 30 cents each
    expect(pricePerUnit(pricePerBase(3.6, 1, "dozen"), "each")).toBeCloseTo(0.3, 10);
  });

  it("rejects zero or negative prices and quantities", () => {
    expect(() => pricePerBase(0, 1, "lb")).toThrow(RangeError);
    expect(() => pricePerBase(2, 0, "lb")).toThrow(RangeError);
    expect(() => pricePerBase(Number.NaN, 1, "lb")).toThrow(RangeError);
  });
});
