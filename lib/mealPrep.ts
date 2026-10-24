import { MEALS, type MealId } from "./plan";

// The meal-prep view's rules (docs/decisions/0022): which recipes to batch-cook and which
// ingredients to prep once for the whole week.

export type Use = { entry: string; date: string; meal: MealId; recipe: string };

export type BatchRecipe = {
  recipeId: string;
  title: string;
  times: number;
  servings: number; // all the planned servings added up: cook this many at once
  uses: { date: string; meal: MealId }[];
};

// Recipes planned more than once in the week: most often first, then by first day.
export function batchRecipes(
  entries: readonly { recipe_id: string; plan_date: string; meal: MealId; servings: number }[],
  titles: ReadonlyMap<string, string>,
): BatchRecipe[] {
  const byRecipe = new Map<string, BatchRecipe>();
  for (const e of [...entries].sort(byDayAndMeal)) {
    const batch = byRecipe.get(e.recipe_id) ?? {
      recipeId: e.recipe_id,
      title: titles.get(e.recipe_id) ?? "Recipe",
      times: 0,
      servings: 0,
      uses: [],
    };
    batch.times += 1;
    batch.servings += e.servings;
    batch.uses.push({ date: e.plan_date, meal: e.meal });
    byRecipe.set(e.recipe_id, batch);
  }
  return [...byRecipe.values()]
    .filter((b) => b.times > 1)
    .sort((a, b) => b.times - a.times || a.uses[0]!.date.localeCompare(b.uses[0]!.date));
}

export type SharedIngredient = {
  name: string;
  quantity: number;
  unit: string | null;
  uses: Use[];
};

// Ingredients with an amount that two or more planned meals use: prep them once ("chop 3
// onions for Mon and Wed"). Lines without an amount ("salt to taste") are left out.
export function sharedIngredients(
  rows: readonly { name: string; quantity: number | null; unit: string | null; uses: Use[] }[],
): SharedIngredient[] {
  return rows
    .flatMap((r) => {
      if (r.quantity === null) return [];
      // One use per planned meal, even if a recipe lists the ingredient twice.
      const uses = [...new Map(r.uses.map((u) => [u.entry, u])).values()];
      return uses.length > 1 ? [{ name: r.name, quantity: r.quantity, unit: r.unit, uses }] : [];
    })
    .sort((a, b) => b.uses.length - a.uses.length);
}

// "Mon dinner"
export function whenLabel(date: string, meal: MealId): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
  return `${weekday} ${MEALS.find((x) => x.id === meal)?.label.toLowerCase() ?? meal}`;
}

const mealIndex = (meal: MealId) => MEALS.findIndex((m) => m.id === meal);
function byDayAndMeal(
  a: { plan_date: string; meal: MealId },
  b: { plan_date: string; meal: MealId },
) {
  return a.plan_date.localeCompare(b.plan_date) || mealIndex(a.meal) - mealIndex(b.meal);
}
