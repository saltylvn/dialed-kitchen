import "server-only";
import { z } from "zod";
import { addDays, serverToday } from "@/lib/dates";
import type { Nutrition } from "@/lib/nutrition";
import { rankRecipes, RECENT_WEEKS } from "@/lib/plan";
import { createClient } from "@/lib/server/supabase";
import { nutritionOf, recipeRowSchema } from "@/features/recipes/schema";
import { planEntryRowSchema, type PlanEntryRow } from "./schema";

// Reads for the meal plan (server-only, household-scoped by RLS, validated).

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// Everything planned for the week starting on `monday`.
export async function getWeekPlan(monday: string): Promise<PlanEntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("id, plan_date, meal, recipe_id, servings")
    .gte("plan_date", monday)
    .lte("plan_date", addDays(monday, 6))
    .order("created_at");
  if (error) fail("meal_plan_entries", error);
  return z.array(planEntryRowSchema).parse(data);
}

// How many times each recipe was planned lately (the last RECENT_WEEKS weeks, plus anything
// already planned ahead). Feeds "regulars" in the recipe box and the plan's recipe picker.
export async function recentPlanCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
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
};

// The recipes to plan from: favorites and regulars first (most planned first), then the rest.
export async function getRecipeChoices(): Promise<RecipeChoice[]> {
  const supabase = await createClient();
  const [recipes, counts] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, servings, favorite, calories, protein_g, carbs_g, fat_g"),
    recentPlanCounts(),
  ]);
  if (recipes.error) fail("recipes", recipes.error);
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
  });
  return [...top.map(choice(true)), ...rest.map(choice(false))];
}
