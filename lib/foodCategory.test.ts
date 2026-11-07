import { describe, expect, it } from "vitest";
import { foodCategory, groupByCategory } from "./foodCategory";

describe("foodCategory", () => {
  it.each([
    ["Bananas", "produce"],
    ["Fresh basil", "produce"],
    ["Jalapeños", "produce"],
    ["Chicken thighs", "meat"],
    ["Salmon fillets", "meat"],
    ["Large eggs", "dairy"],
    ["Greek yogurt", "dairy"],
    ["Sour cream", "dairy"],
    ["Sourdough bread", "bakery"],
    ["Flour tortillas", "bakery"],
    ["Jasmine rice", "pantry"],
    ["Old-fashioned oats", "pantry"],
    ["Chicken broth", "pantry"],
    ["Chili powder", "pantry"],
    ["Peanut butter", "pantry"],
    ["Olive oil", "pantry"],
    ["Dark chocolate", "snacks"],
    ["Orange juice", "snacks"],
    ["Coffee beans", "pantry"], // the last food word wins: beans
    ["Paper towels", "other"],
    ["Tacos 🌮", "other"], // an emoji typed in the name isn't read
  ])("%s → %s", (name, category) => {
    expect(foodCategory(name)).toBe(category);
  });
});

describe("groupByCategory", () => {
  it("groups in store order, keeps order within a section, skips empty sections", () => {
    const names = ["Rice", "Apples", "Paper towels", "Eggs", "Pasta"];
    const groups = groupByCategory(names, (n) => n);
    expect(groups.map((g) => [g.label, g.things])).toEqual([
      ["Produce", ["Apples"]],
      ["Dairy & eggs", ["Eggs"]],
      ["Pantry", ["Rice", "Pasta"]],
      ["Other", ["Paper towels"]],
    ]);
  });
});
