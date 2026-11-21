import "server-only";
import { z } from "zod";
import { addDays, serverToday } from "@/lib/dates";
import type { Nutrition } from "@/lib/nutrition";
import { rankRecipes, RECENT_WEEKS, type MealId } from "@/lib/plan";
import type { PriceEstimate } from "@/lib/weekCost";
import type { ShoppingRow } from "@/lib/weekShopping";
import { createClient } from "@/lib/server/db";
import { matchKey } from "@/lib/ingredients";
import { inStockKeys } from "@/features/stock/queries";
import { nutritionOf, recipeRowSchema } from "@/features/recipes/schema";
import { planEntryRowSchema, type PlanEntryRow } from "./schema";

// Reads for the meal plan (server-only, household-scoped by RLS, validated).

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// Everything planned for the week starting on `monday`.
export async function getWeekPlan(monday: string): Promise<PlanEntryRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("meal_plan_entries")
    .select("id, plan_date, meal, recipe_id, servings, leftover_of")
    .gte("plan_date", monday)
    .lte("plan_date", addDays(monday, 6))
    .order("created_at");
  if (error) fail("meal_plan_entries", error);
  return z.array(planEntryRowSchema).parse(data);
}

// How many times each recipe was planned lately (the last RECENT_WEEKS weeks, plus anything
// already planned ahead). Feeds "regulars" in the recipe box and the plan's recipe picker.
export async function recentPlanCounts(): Promise<Map<string, number>> {
  const db = await createClient();
  const { data, error } = await db
    .from("meal_plan_entries")
    .select("recipe_id")
    .gte("plan_date", addDays(serverToday(), -7 * RECENT_WEEKS));
  if (error) fail("meal_plan_entries", error);
  const counts = new Map<string, number>();
  for (const { recipe_id } of z.array(z.object({ recipe_id: z.uuid() })).parse(data)) {
    counts.set(recipe_id, (counts.get(recipe_id) ?? 0) + 1);
  }
  return counts;
}

export type RecipeChoice = {
  id: string;
  title: string;
  servings: number;
  top: boolean;
  nutrition: Nutrition; // per serving
  meals: MealId[]; // empty: not sorted yet
  stock: { have: number; total: number }; // ingredients In stock, for "4 of 5 in stock"
};

// The recipes to plan from: favorites and regulars first (most planned first), then the rest,
// each with how many of its ingredients are In stock (plan from what you have; decision 0053).
export async function getRecipeChoices(): Promise<RecipeChoice[]> {
  const db = await createClient();
  const [recipes, counts, ingredients, items, stock] = await Promise.all([
    db
      .from("recipes")
      .select("id, title, servings, favorite, calories, protein_g, carbs_g, fat_g, meals"),
    recentPlanCounts(),
    db.from("recipe_ingredients").select("recipe_id, name, item_id"),
    db.from("items").select("id, name"),
    inStockKeys(),
  ]);
  if (recipes.error) fail("recipes", recipes.error);
  if (ingredients.error) fail("recipe_ingredients", ingredients.error);
  if (items.error) fail("items", items.error);

  // Same matching as the recipe box: the ingredient's own name, or its price-book item's.
  const itemNames = new Map(
    z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .parse(items.data)
      .map((i) => [i.id, i.name]),
  );
  const stockByRecipe = new Map<string, { have: number; total: number }>();
  for (const row of z
    .array(z.object({ recipe_id: z.uuid(), name: z.string(), item_id: z.uuid().nullable() }))
    .parse(ingredients.data)) {
    const tally = stockByRecipe.get(row.recipe_id) ?? { have: 0, total: 0 };
    tally.total++;
    const itemName = row.item_id ? itemNames.get(row.item_id) : undefined;
    if (stock.has(matchKey(row.name)) || (itemName && stock.has(matchKey(itemName)))) tally.have++;
    stockByRecipe.set(row.recipe_id, tally);
  }
  const rows = z
    .array(
      recipeRowSchema.pick({
        id: true,
        title: true,
        servings: true,
        favorite: true,
        calories: true,
        protein_g: true,
        carbs_g: true,
        fat_g: true,
        meals: true,
      }),
    )
    .parse(recipes.data)
    .map((r) => ({ ...r, timesPlanned: counts.get(r.id) ?? 0 }));
  const { top, rest } = rankRecipes(rows);
  const choice = (isTop: boolean) => (r: (typeof rows)[number]) => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    top: isTop,
    nutrition: nutritionOf(r),
    meals: r.meals,
    stock: stockByRecipe.get(r.id) ?? { have: 0, total: 0 },
  });
  return [...top.map(choice(true)), ...rest.map(choice(false))];
}

// What the week's meals need, with In stock, on-the-list and estimated cost (worked out by
// the database's week_shopping, so the card and "Add to grocery list" always agree).
export async function getWeekShopping(monday: string): Promise<ShoppingRow[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("week_shopping", { week_start: monday });
  if (error) fail("week_shopping", error);
  return z
    .array(
      z.object({
        name: z.string(),
        quantity: z.coerce.number().nullable(),
        unit: z.string().nullable(),
        in_stock: z.boolean(),
        on_list: z.boolean(),
        est_cost: z.coerce.number().nullable(),
      }),
    )
    .parse(data);
}

// The household's weekly grocery budget (decision 0053), or null when none is set.
export async function getWeeklyBudget(): Promise<number | null> {
  const db = await createClient();
  const { data, error } = await db.from("households").select("weekly_budget").maybeSingle();
  if (error) fail("households", error);
  if (!data) return null;
  return z.object({ weekly_budget: z.coerce.number().nullable() }).parse(data).weekly_budget;
}

// How long an AI price estimate is trusted before it's asked for again (decision 0057).
export const ESTIMATE_MAX_AGE_DAYS = 90;

const estimateRowSchema = z.object({
  key: z.string(),
  dimension: z.enum(["weight", "volume", "count"]),
  unit_price_base: z.coerce.number().positive(),
});

// The household's AI price estimates still fresh enough to use (decision 0057).
export async function getPriceEstimates(): Promise<PriceEstimate[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("price_estimates")
    .select("key, dimension, unit_price_base")
    .gte("estimated_on", addDays(serverToday(), -ESTIMATE_MAX_AGE_DAYS));
  if (error) fail("price_estimates", error);
  return z
    .array(estimateRowSchema)
    .parse(data)
    .map((r) => ({ key: r.key, dimension: r.dimension, unitPriceBase: r.unit_price_base }));
}
