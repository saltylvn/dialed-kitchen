import "server-only";
import { z } from "zod";
import { formatIngredient, matchKey } from "@/lib/ingredients";
import { formatAmount } from "@/lib/list";
import { createClient } from "@/lib/server/supabase";
import { recentPlanCounts } from "@/features/plan/queries";
import { inStockKeys } from "@/features/stock/queries";
import { ingredientRowSchema, recipeRowSchema, type RecipeRow } from "./schema";

// Reads for the recipe box (server-only, household-scoped by RLS, validated).

export type RecipeView = RecipeRow & {
  timesPlanned: number; // in the last few weeks (lib/plan RECENT_WEEKS)
  ingredients: { id: string; amount: string; name: string; linked: boolean; inStock: boolean }[];
};

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// Every recipe with its ingredients, what's In stock, and how often it was planned lately,
// read in parallel. An ingredient is In stock when its name, or its price-book item's name,
// matches something In stock (the same rule the database uses).
export async function listRecipes(): Promise<RecipeView[]> {
  const supabase = await createClient();
  const [recipes, ingredients, items, stock, planCounts] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, servings, source_type, source_name, source_url, steps, favorite")
      .order("favorite", { ascending: false })
      .order("title"),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, sort_order, quantity, unit, name, item_id")
      .order("sort_order"),
    supabase.from("items").select("id, name"),
    inStockKeys(),
    recentPlanCounts(),
  ]);
  if (recipes.error) fail("recipes", recipes.error);
  if (ingredients.error) fail("recipe_ingredients", ingredients.error);
  if (items.error) fail("items", items.error);

  const itemNames = new Map(
    z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .parse(items.data)
      .map((i) => [i.id, i.name]),
  );
  const byRecipe = new Map<string, RecipeView["ingredients"]>();
  for (const row of z.array(ingredientRowSchema).parse(ingredients.data)) {
    const list = byRecipe.get(row.recipe_id) ?? [];
    list.push({
      id: `${row.recipe_id}-${row.sort_order}`,
      amount: formatAmount(row.quantity, row.unit),
      name: row.name,
      linked: row.item_id !== null,
      inStock:
        stock.has(matchKey(row.name)) ||
        (row.item_id !== null && stock.has(matchKey(itemNames.get(row.item_id) ?? row.name))),
    });
    byRecipe.set(row.recipe_id, list);
  }
  return z
    .array(recipeRowSchema)
    .parse(recipes.data)
    .map((r) => ({
      ...r,
      timesPlanned: planCounts.get(r.id) ?? 0,
      ingredients: byRecipe.get(r.id) ?? [],
    }));
}

export type RecipeForEdit = RecipeRow & { ingredientsText: string; stepsText: string };

// One recipe, with ingredients and steps turned back into editable text. null if not yours.
export async function getRecipeForEdit(id: string): Promise<RecipeForEdit | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const [recipe, ingredients] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, servings, source_type, source_name, source_url, steps, favorite")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, sort_order, quantity, unit, name, item_id")
      .eq("recipe_id", id)
      .order("sort_order"),
  ]);
  if (recipe.error) fail("recipe", recipe.error);
  if (ingredients.error) fail("recipe_ingredients", ingredients.error);
  if (!recipe.data) return null;

  const row = recipeRowSchema.parse(recipe.data);
  return {
    ...row,
    ingredientsText: z
      .array(ingredientRowSchema)
      .parse(ingredients.data)
      .map((i) => formatIngredient(i))
      .join("\n"),
    stepsText: row.steps.join("\n"),
  };
}
