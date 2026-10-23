import { describe, expect, it } from "vitest";
import { addDays, serverToday } from "../../lib/dates";
import { itemFormSchema, parseMoney, parseQuantity, priceFormSchema } from "./schema";

const ITEM = "00000000-0000-4000-8000-000000000001";
const valid = {
  itemId: ITEM,
  storeName: "  Aldi ",
  price: "$3.49",
  quantity: "2",
  unit: "lb",
  onSale: "on",
  observedOn: serverToday(),
};

describe("reading typed numbers", () => {
  it("understands prices the way people type them", () => {
    expect(parseMoney("$3.49")).toBe(3.49);
    expect(parseMoney("1,299.00")).toBe(1299);
    expect(parseMoney(".99")).toBe(0.99);
    for (const bad of ["", "abc", "3.499", "-2", "3.4.5", "1e3"])
      expect(parseMoney(bad), bad).toBeNull();
  });

  it("understands package sizes", () => {
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity(".75")).toBe(0.75);
    for (const bad of ["", "two", "1.2345", "-1", "1/2"])
      expect(parseQuantity(bad), bad).toBeNull();
  });
});

describe("priceFormSchema", () => {
  it("accepts a normal entry and tidies it", () => {
    expect(priceFormSchema.parse(valid)).toEqual({
      itemId: ITEM,
      storeName: "Aldi",
      price: 3.49,
      quantity: 2,
      unit: "lb",
      onSale: true,
      observedOn: serverToday(),
    });
    expect(priceFormSchema.parse({ ...valid, onSale: undefined }).onSale).toBe(false);
  });

  it("rejects bad input with a helpful message", () => {
    const cases: [Partial<typeof valid>, RegExp][] = [
      [{ price: "0" }, /Enter the price/],
      [{ price: "free" }, /Enter the price/],
      [{ quantity: "0" }, /package size/],
      [{ unit: "cup" }, /Choose a unit/],
      [{ storeName: "   " }, /Enter a store name/],
      [{ observedOn: addDays(serverToday(), 3) }, /in the future/],
      [{ observedOn: "2026-02-30" }, /Choose a date/],
      [{ itemId: "not-a-uuid" }, /UUID/i],
    ];
    for (const [change, message] of cases) {
      const result = priceFormSchema.safeParse({ ...valid, ...change });
      expect(result.success, JSON.stringify(change)).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(message);
    }
  });
});

describe("itemFormSchema", () => {
  it("collapses extra spaces in names and checks the unit", () => {
    expect(itemFormSchema.parse({ name: "  Chicken   thighs ", compareUnit: "lb" })).toEqual({
      name: "Chicken thighs",
      compareUnit: "lb",
    });
    expect(itemFormSchema.safeParse({ name: "Milk", compareUnit: "pints" }).success).toBe(false);
  });
});
