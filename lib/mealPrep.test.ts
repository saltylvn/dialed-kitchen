import { describe, expect, it } from "vitest";
import { batchRecipes, sharedIngredients, whenLabel, type Use } from "./mealPrep";

describe("batchRecipes", () => {
  it("finds recipes planned more than once, adds up servings, most often first", () => {
    const titles = new Map([
      ["tacos", "Tacos"],
      ["oats", "Overnight oats"],
      ["soup", "Soup"],
    ]);
    const batches = batchRecipes(
      [
        { recipe_id: "tacos", plan_date: "2026-10-29", meal: "dinner", servings: 4 },
        { recipe_id: "oats", plan_date: "2026-10-27", meal: "breakfast", servings: 2 },
        { recipe_id: "tacos", plan_date: "2026-10-26", meal: "dinner", servings: 4 },
        { recipe_id: "oats", plan_date: "2026-10-26", meal: "breakfast", servings: 2 },
        { recipe_id: "oats", plan_date: "2026-10-28", meal: "breakfast", servings: 2 },
        { recipe_id: "soup", plan_date: "2026-10-28", meal: "lunch", servings: 4 }, // once: no batch
      ],
      titles,
    );
    expect(batches.map((b) => [b.title, b.times, b.servings, b.uses.map((u) => u.date)])).toEqual([
      ["Overnight oats", 3, 6, ["2026-10-26", "2026-10-27", "2026-10-28"]],
      ["Tacos", 2, 8, ["2026-10-26", "2026-10-29"]],
    ]);
  });
});

describe("sharedIngredients", () => {
  const use = (entry: string, date = "2026-10-26"): Use => ({
    entry,
    date,
    meal: "dinner",
    recipe: "R",
  });

  it("keeps ingredients two or more meals use, most shared first", () => {
    const shared = sharedIngredients([
      { name: "rice", quantity: 3, unit: "cup", uses: [use("a"), use("b")] },
      { name: "onion", quantity: 3, unit: null, uses: [use("a"), use("b"), use("c")] },
      { name: "lime", quantity: 1, unit: null, uses: [use("a")] }, // one meal
      { name: "salt to taste", quantity: null, unit: null, uses: [use("a"), use("b")] }, // no amount
      { name: "garlic", quantity: 2, unit: null, uses: [use("a"), use("a")] }, // same meal twice
    ]);
    expect(shared.map((s) => [s.name, s.uses.length])).toEqual([
      ["onion", 3],
      ["rice", 2],
    ]);
  });
});

describe("whenLabel", () => {
  it("reads like the plan", () => {
    expect(whenLabel("2026-10-26", "dinner")).toBe("Mon dinner");
    expect(whenLabel("2026-11-01", "snacks")).toBe("Sun snacks");
  });
});
