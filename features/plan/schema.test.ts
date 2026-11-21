import { describe, expect, it } from "vitest";
import { budgetSchema, leftoversSchema } from "./schema";

const id = "6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("leftoversSchema", () => {
  it("accepts a later day, a meal and servings", () => {
    expect(
      leftoversSchema.parse({ source: id, date: "2026-11-24", meal: "lunch", servings: "2" }),
    ).toEqual({ source: id, date: "2026-11-24", meal: "lunch", servings: 2 });
  });

  it("refuses a bad meal, date or servings", () => {
    const ok = { source: id, date: "2026-11-24", meal: "lunch", servings: 2 };
    expect(leftoversSchema.safeParse({ ...ok, meal: "brunch" }).success).toBe(false);
    expect(leftoversSchema.safeParse({ ...ok, date: "tomorrow" }).success).toBe(false);
    expect(leftoversSchema.safeParse({ ...ok, servings: 0 }).success).toBe(false);
    expect(leftoversSchema.safeParse({ ...ok, source: "x" }).success).toBe(false);
  });
});

describe("budgetSchema", () => {
  it("takes a positive amount up to $10,000, or none", () => {
    expect(budgetSchema.safeParse(160).success).toBe(true);
    expect(budgetSchema.safeParse(null).success).toBe(true);
    expect(budgetSchema.safeParse(0).success).toBe(false);
    expect(budgetSchema.safeParse(10001).success).toBe(false);
  });
});
