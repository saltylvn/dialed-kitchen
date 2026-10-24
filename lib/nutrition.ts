// Nutrition per serving, and a day's totals per person (docs/decisions/0018). Every value is
// optional: a recipe may have calories but no macros, or nothing yet. Totals never pretend:
// meals without a number are listed so the total is read as "at least".

export type Nutrition = {
  calories: number | null; // kcal per serving
  protein: number | null; // grams per serving
  carbs: number | null;
  fat: number | null;
};

export const NO_NUTRITION: Nutrition = { calories: null, protein: null, carbs: null, fat: null };

// Sensible upper limits for one serving (the database checks the same).
export const MAX_CALORIES = 5000;
export const MAX_GRAMS = 1000;

export function hasNutrition(n: Nutrition): boolean {
  return n.calories !== null || n.protein !== null || n.carbs !== null || n.fat !== null;
}

function clean(value: number | null | undefined, max: number, decimals: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > max)
    return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Rounds and range-checks a set of values: calories whole, grams to one decimal.
export function cleanNutrition(n: Partial<Record<keyof Nutrition, number | null>>): Nutrition {
  return {
    calories: clean(n.calories, MAX_CALORIES, 0),
    protein: clean(n.protein, MAX_GRAMS, 1),
    carbs: clean(n.carbs, MAX_GRAMS, 1),
    fat: clean(n.fat, MAX_GRAMS, 1),
  };
}

// "250 calories", "12 g", "12.5g", 12, "1,200 kcal" → the number. Anything else → null.
function firstNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = /-?\d[\d,]*(\.\d+)?/.exec(value); // keep a minus, so it gets refused
  return match ? Number(match[0].replace(/,/g, "")) : null;
}

// schema.org NutritionInformation from a recipe page (values are per serving).
export function nutritionFromSchemaOrg(value: unknown): Nutrition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NO_NUTRITION;
  const info = value as Record<string, unknown>;
  return cleanNutrition({
    calories: firstNumber(info.calories),
    protein: firstNumber(info.proteinContent),
    carbs: firstNumber(info.carbohydrateContent),
    fat: firstNumber(info.fatContent),
  });
}

export type MealNutrition = { label: string; nutrition: Nutrition };

export type DayTotals = {
  totals: Nutrition; // sums of what's known; null when no meal has that value
  missing: { calories: string[]; macros: string[] }; // meals without the value
};

// A day per person: one serving of each planned meal.
export function dayTotals(meals: readonly MealNutrition[]): DayTotals {
  const sum = (key: keyof Nutrition, decimals: number) => {
    const known = meals.map((m) => m.nutrition[key]).filter((v): v is number => v !== null);
    if (known.length === 0) return null;
    const factor = 10 ** decimals;
    return Math.round(known.reduce((a, b) => a + b, 0) * factor) / factor;
  };
  return {
    totals: {
      calories: sum("calories", 0),
      protein: sum("protein", 0),
      carbs: sum("carbs", 0),
      fat: sum("fat", 0),
    },
    missing: {
      calories: meals.filter((m) => m.nutrition.calories === null).map((m) => m.label),
      macros: meals
        .filter(
          (m) =>
            m.nutrition.protein === null || m.nutrition.carbs === null || m.nutrition.fat === null,
        )
        .map((m) => m.label),
    },
  };
}

// "1,850 kcal", "120 g", or "–" for unknown.
export function formatCalories(value: number | null): string {
  return value === null ? "–" : `${new Intl.NumberFormat("en-US").format(value)} kcal`;
}

export function formatGrams(value: number | null): string {
  return value === null
    ? "–"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} g`;
}
