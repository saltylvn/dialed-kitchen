import { describe, expect, it } from "vitest";
import { parseRecipeAnswer } from "./recipeFromImage";

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    found: true,
    title: "Grandma's Biscuits",
    servings: 8,
    sourceName: "Joy of Cooking, p. 612",
    ingredients: ["2 cups flour", "1 tbsp baking powder"],
    steps: ["Heat the oven.", "Mix and bake."],
    ...over,
  });

describe("parseRecipeAnswer", () => {
  it("accepts a well-formed answer", () => {
    expect(parseRecipeAnswer(answer())).toEqual({
      ok: true,
      recipe: {
        found: true,
        title: "Grandma's Biscuits",
        servings: 8,
        sourceName: "Joy of Cooking, p. 612",
        ingredients: ["2 cups flour", "1 tbsp baking powder"],
        steps: ["Heat the oven.", "Mix and bake."],
        nutrition: { calories: null, protein: null, carbs: null, fat: null },
      },
    });
  });

  it("keeps printed nutrition, and drops impossible values", () => {
    const parsed = parseRecipeAnswer(
      answer({ calories: 210, proteinGrams: 4.25, carbsGrams: null, fatGrams: 99999 }),
    );
    expect(parsed.ok && parsed.recipe.nutrition).toEqual({
      calories: 210,
      protein: 4.3,
      carbs: null,
      fat: null,
    });
  });

  it("tidies whitespace and drops empty lines", () => {
    const parsed = parseRecipeAnswer(
      answer({ title: "  Big \n Soup ", ingredients: ["  1  onion ", "", " "] }),
    );
    expect(parsed.ok && parsed.recipe.title).toBe("Big Soup");
    expect(parsed.ok && parsed.recipe.ingredients).toEqual(["1 onion"]);
  });

  it("keeps everything within the app's limits", () => {
    const parsed = parseRecipeAnswer(
      answer({ title: "x".repeat(250), servings: 400, ingredients: Array(250).fill("1 egg") }),
    );
    expect(parsed.ok && parsed.recipe.title).toHaveLength(120);
    expect(parsed.ok && parsed.recipe.servings).toBe(50);
    expect(parsed.ok && parsed.recipe.ingredients).toHaveLength(200);
  });

  it("treats zero, negative or missing servings as unknown", () => {
    for (const servings of [0, -2, null, undefined]) {
      const parsed = parseRecipeAnswer(answer({ servings }));
      expect(parsed.ok && parsed.recipe.servings, String(servings)).toBeNull();
    }
  });

  it("refuses replies that aren't JSON, have the wrong shape, or have no recipe", () => {
    expect(parseRecipeAnswer("Sure! Here is the recipe…")).toEqual({
      ok: false,
      reason: "not_json",
    });
    expect(parseRecipeAnswer(answer({ ingredients: "2 cups flour" }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(parseRecipeAnswer(answer({ steps: [{ html: "<script>" }] }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(
      parseRecipeAnswer(answer({ found: false, title: "", ingredients: [], steps: [] })),
    ).toEqual({
      ok: false,
      reason: "no_recipe",
    });
  });

  it("refuses absurdly large replies outright", () => {
    expect(parseRecipeAnswer(answer({ title: "x".repeat(1000) }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(parseRecipeAnswer(answer({ ingredients: Array(400).fill("1 egg") }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
  });
});
