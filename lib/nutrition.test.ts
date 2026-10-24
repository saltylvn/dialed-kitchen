import { describe, expect, it } from "vitest";
import {
  cleanNutrition,
  dayTotals,
  formatCalories,
  formatGrams,
  NO_NUTRITION,
  nutritionFromSchemaOrg,
} from "./nutrition";

describe("nutritionFromSchemaOrg", () => {
  it("reads the numbers sites write in many ways", () => {
    expect(
      nutritionFromSchemaOrg({
        "@type": "NutritionInformation",
        calories: "1,250 calories",
        proteinContent: "32.4 g",
        carbohydrateContent: "45g",
        fatContent: 12,
      }),
    ).toEqual({ calories: 1250, protein: 32.4, carbs: 45, fat: 12 });
  });

  it("leaves out what's missing or nonsense", () => {
    expect(nutritionFromSchemaOrg({ calories: "about lots", fatContent: "-3 g" })).toEqual(
      NO_NUTRITION,
    );
    expect(nutritionFromSchemaOrg("250 calories")).toEqual(NO_NUTRITION);
    expect(nutritionFromSchemaOrg(null)).toEqual(NO_NUTRITION);
  });
});

describe("cleanNutrition", () => {
  it("rounds and refuses values out of range", () => {
    expect(
      cleanNutrition({ calories: 250.6, protein: 12.345, carbs: 9999, fat: Number.NaN }),
    ).toEqual({
      calories: 251,
      protein: 12.3,
      carbs: null,
      fat: null,
    });
  });
});

describe("dayTotals", () => {
  const meal = (label: string, n: Partial<typeof NO_NUTRITION>) => ({
    label,
    nutrition: { ...NO_NUTRITION, ...n },
  });

  it("adds one serving of each meal and names the meals without numbers", () => {
    const day = dayTotals([
      meal("Breakfast", { calories: 400, protein: 20, carbs: 50, fat: 10 }),
      meal("Lunch", { calories: 650 }),
      meal("Dinner", { calories: 800.4, protein: 45.6, carbs: 60, fat: 30 }),
      meal("Snacks", {}),
    ]);
    expect(day.totals).toEqual({ calories: 1850, protein: 66, carbs: 110, fat: 40 });
    expect(day.missing).toEqual({ calories: ["Snacks"], macros: ["Lunch", "Snacks"] });
  });

  it("shows unknown, not zero, when nothing is known", () => {
    expect(dayTotals([meal("Dinner", {})]).totals).toEqual(NO_NUTRITION);
    expect(dayTotals([]).totals).toEqual(NO_NUTRITION);
  });
});

describe("formatting", () => {
  it("reads naturally", () => {
    expect(formatCalories(1850)).toBe("1,850 kcal");
    expect(formatGrams(32.4)).toBe("32.4 g");
    expect(formatCalories(null)).toBe("–");
  });
});
