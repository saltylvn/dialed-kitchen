import { describe, expect, it } from "vitest";
import { nutritionPrompt, parseNutritionAnswer } from "./nutritionEstimate";

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    estimable: true,
    calories: 512.4,
    proteinGrams: 31.26,
    carbsGrams: 48,
    fatGrams: 18.5,
    ...over,
  });

describe("parseNutritionAnswer", () => {
  it("accepts a sensible estimate, rounded", () => {
    expect(parseNutritionAnswer(answer())).toEqual({
      ok: true,
      nutrition: { calories: 512, protein: 31.3, carbs: 48, fat: 18.5 },
    });
  });

  it("refuses anything it can't trust", () => {
    expect(parseNutritionAnswer("about 500 calories")).toEqual({ ok: false, reason: "not_json" });
    expect(parseNutritionAnswer(answer({ calories: "500" }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(parseNutritionAnswer(answer({ calories: 25000 }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(parseNutritionAnswer(answer({ fatGrams: -4 }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
    expect(parseNutritionAnswer(answer({ estimable: false }))).toEqual({
      ok: false,
      reason: "not_estimable",
    });
  });
});

describe("nutritionPrompt", () => {
  it("lists the recipe as data, within limits", () => {
    const prompt = nutritionPrompt({
      title: "Chili",
      servings: 6,
      ingredients: ["1 lb beef", "x".repeat(500)],
    });
    expect(prompt).toContain("Servings: 6");
    expect(prompt).toContain("- 1 lb beef");
    expect(prompt.split("\n").every((line) => line.length <= 202)).toBe(true);
  });
});
