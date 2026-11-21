import { describe, expect, it } from "vitest";
import { ateItSchema, goalSchema, quickAddSchema } from "./schema";

const quick = {
  date: "2026-11-23",
  meal: "snacks",
  label: " Protein bar ",
  calories: "200",
  protein: "",
};

describe("quickAddSchema", () => {
  it("accepts a typed snack, trimming the name; empty protein is unknown", () => {
    expect(quickAddSchema.parse(quick)).toEqual({
      date: "2026-11-23",
      meal: "snacks",
      label: "Protein bar",
      calories: 200,
      protein: null,
    });
  });

  it("refuses a missing name, odd calories, a made-up meal or date", () => {
    expect(quickAddSchema.safeParse({ ...quick, label: "  " }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...quick, calories: "abc" }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...quick, calories: "12.5" }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...quick, calories: "-1" }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...quick, meal: "brunch" }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...quick, date: "2026-02-30" }).success).toBe(false);
  });
});

describe("ateItSchema", () => {
  it("takes a portion from ½ to 10, or none for the usual", () => {
    const id = "6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(ateItSchema.safeParse({ entryId: id, portion: null }).success).toBe(true);
    expect(ateItSchema.safeParse({ entryId: id, portion: 1.5 }).success).toBe(true);
    expect(ateItSchema.safeParse({ entryId: id, portion: 0 }).success).toBe(false);
    expect(ateItSchema.safeParse({ entryId: "nope", portion: 1 }).success).toBe(false);
  });
});

describe("goalSchema", () => {
  it("keeps goals realistic", () => {
    expect(goalSchema.safeParse({ calories: 2000, protein: 150 }).success).toBe(true);
    expect(goalSchema.safeParse({ calories: 300, protein: 150 }).success).toBe(false);
  });
});
