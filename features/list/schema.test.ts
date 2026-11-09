import { describe, expect, it } from "vitest";
import { addToListSchema } from "./schema";

describe("addToListSchema", () => {
  it("keeps a plain unit and amount", () => {
    expect(addToListSchema.parse({ name: "Rice", quantity: "2", unit: "lb" })).toEqual({
      name: "Rice",
      quantity: 2,
      unit: "lb",
    });
  });

  it("saves 1 × ½ gal as 0.5 gal, and reads typed fractions", () => {
    expect(addToListSchema.parse({ name: "Milk", quantity: "1", unit: "half_gal" })).toEqual({
      name: "Milk",
      quantity: 0.5,
      unit: "gal",
    });
    expect(addToListSchema.parse({ name: "Milk", quantity: "1/2", unit: "gal" })).toMatchObject({
      quantity: 0.5,
    });
  });

  it("allows no amount and no unit", () => {
    expect(addToListSchema.parse({ name: "Bananas" })).toEqual({
      name: "Bananas",
      quantity: null,
      unit: null,
    });
  });

  it("keeps the real unit when there's no amount, so the action can ask for one", () => {
    expect(addToListSchema.parse({ name: "Milk", unit: "half_gal" })).toMatchObject({
      quantity: null,
      unit: "gal",
    });
  });

  it("refuses an unknown unit", () => {
    expect(addToListSchema.safeParse({ name: "Milk", quantity: "1", unit: "pints" }).success).toBe(
      false,
    );
  });
});
