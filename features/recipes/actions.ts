"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GENERIC_ERROR, type ActionResult } from "@/lib/actionResult";
import { matchKey } from "@/lib/ingredients";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { recipeFormSchema } from "./schema";

// Recipe actions. Input is validated here; the database checks it all again, and save_recipe
// stores the recipe and its ingredients together (all or nothing).

export type SaveRecipeResult = ActionResult | null;

export async function saveRecipe(
  _prev: SaveRecipeResult,
  formData: FormData,
): Promise<SaveRecipeResult> {
  await requireUser();
  const parsed = recipeFormSchema.safeParse({
    recipeId: formData.get("recipeId") || null,
    title: formData.get("title"),
    servings: formData.get("servings"),
    sourceType: formData.get("sourceType"),
    sourceName: formData.get("sourceName") ?? undefined,
    sourceUrl: formData.get("sourceUrl") ?? undefined,
    ingredients: formData.get("ingredients") ?? "",
    steps: formData.get("steps") ?? "",
    calories: formData.get("calories") ?? undefined,
    protein: formData.get("protein") ?? undefined,
    carbs: formData.get("carbs") ?? undefined,
    fat: formData.get("fat") ?? undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const recipe = parsed.data;

  const supabase = await createClient();
  // Link ingredients to price-book items by name ("Chicken thighs, boneless" → Chicken thighs).
  const { data: items, error: itemsError } = await supabase.from("items").select("id, name");
  if (itemsError) {
    console.error("save recipe: items failed:", itemsError.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  const itemIds = new Map(items.map((i) => [i.name.toLowerCase(), i.id as string]));

  const { data: id, error } = await supabase.rpc("save_recipe", {
    recipe_id: recipe.recipeId,
    title: recipe.title,
    servings: recipe.servings,
    source_type: recipe.sourceType,
    source_name: recipe.sourceName,
    source_url: recipe.sourceUrl,
    steps: recipe.steps,
    ingredients: recipe.ingredients.map((i) => ({
      quantity: i.quantity,
      unit: i.unit,
      name: i.name,
      item_id: itemIds.get(matchKey(i.name)) ?? null,
    })),
    nutrition: {
      calories: recipe.calories,
      protein_g: recipe.protein,
      carbs_g: recipe.carbs,
      fat_g: recipe.fat,
    },
  });
  if (error) {
    console.error("save recipe failed:", error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/recipes");
  redirect(`/recipes?open=${z.uuid().parse(id)}`);
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await requireUser();
  if (!z.uuid().safeParse(id).success || typeof favorite !== "boolean") return;
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ favorite }).eq("id", id);
  if (error) {
    console.error("set favorite failed:", error.message);
    throw new Error("Couldn't save that. Check your connection and try again.");
  }
  revalidatePath("/recipes");
}

export type AddToListResult = ActionResult<{ added: number }>;

export async function addRecipeToList(id: string): Promise<AddToListResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_recipe_to_list", { recipe_id: id });
  if (error) {
    console.error("add recipe to list failed:", error.message);
    return { ok: false, error: "Couldn't add to the list. Check your connection and try again." };
  }
  revalidatePath("/grocery", "layout");
  return { ok: true, data: { added: z.number().int().parse(data) } };
}

export async function deleteRecipe(formData: FormData): Promise<void> {
  await requireUser();
  const id = z.uuid().safeParse(formData.get("recipeId"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id.data);
  if (error) console.error("delete recipe failed:", error.message);
  revalidatePath("/recipes");
  redirect("/recipes");
}
