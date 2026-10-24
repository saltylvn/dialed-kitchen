"use server";

import { formatIngredient, parseIngredientLines } from "@/lib/ingredients";
import { z } from "zod";
import type { Nutrition } from "@/lib/nutrition";
import { checkPhotos } from "@/lib/photos";
import { extractRecipe, pageTitle } from "@/lib/recipeImport";
import { LinkRefused } from "@/lib/security/fetchUrl";
import { requireUser } from "@/lib/server/auth";
import { DAILY_AI_LIMIT, takeAiRequest } from "@/lib/server/aiLimit";
import { estimateNutrition, readRecipeFromPhotos } from "@/lib/server/gemini";
import { fetchPublicPage, FetchRefused } from "@/lib/server/safeFetch";
import type { RecipeDraft } from "./schema";

// Import a recipe from a link or from photos: fetch the page safely (lib/server/safeFetch), read its
// standard recipe data (lib/recipeImport), and return a draft for the person to check and
// save. Nothing is saved here, and photos are never stored.

export type ImportResult =
  { ok: true; draft: RecipeDraft; complete: boolean } | { ok: false; error: string } | null;

export async function importRecipe(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  await requireUser();
  const link = String(formData.get("link") ?? "");

  let page: Awaited<ReturnType<typeof fetchPublicPage>>;
  try {
    page = await fetchPublicPage(link);
  } catch (error) {
    if (error instanceof LinkRefused || error instanceof FetchRefused) {
      return { ok: false, error: error.message };
    }
    console.error("recipe import fetch failed:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "Couldn't open that page. Check the link, or try again in a moment.",
    };
  }

  const source = {
    source_type: "website" as const,
    source_url: page.url.toString(),
  };
  const recipe = extractRecipe(page.html);

  if (!recipe) {
    // No standard recipe data: start the form with what we know.
    return {
      ok: true,
      complete: false,
      draft: {
        ...source,
        title: pageTitle(page.html) ?? "",
        servings: 4,
        source_name: page.url.hostname.replace(/^www\./, ""),
        ingredientsText: "",
        stepsText: "",
      },
    };
  }

  return {
    ok: true,
    complete: true,
    draft: {
      ...source,
      title: recipe.title,
      servings: recipe.servings ?? 4,
      source_name: (recipe.siteName ?? page.url.hostname.replace(/^www\./, "")).slice(0, 120),
      // Read each line the same way as typed ones, then write it back tidily (½, 1½…).
      ingredientsText: parseIngredientLines(recipe.ingredients.join("\n"))
        .map(formatIngredient)
        .join("\n"),
      stepsText: recipe.steps.join("\n"),
      nutrition: recipe.nutrition,
    },
  };
}

const PHOTO_ERRORS = {
  not_configured: "Reading photos isn't set up yet. You can type the recipe in below.",
  busy: "The AI is busy right now (free tier). Try again in a minute.",
  no_recipe: "Couldn't find a recipe in that photo. Try a sharper, closer photo of the page.",
  failed: "Couldn't read that photo. Try again, or type the recipe in below.",
} as const;

export async function importRecipeFromPhotos(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  await requireUser();

  const files = formData.getAll("photo");
  if (!files.every((f): f is File => f instanceof File))
    return { ok: false, error: PHOTO_ERRORS.failed };
  // (The whole request is capped at 4 MB by serverActions.bodySizeLimit in next.config.ts.)
  const photos = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
  const check = checkPhotos(photos);
  if (!check.ok) return check;

  // Count this request against the daily limit (atomic, in the database).
  const allowance = await takeAiRequest();
  if (allowance === "error") return { ok: false, error: PHOTO_ERRORS.failed };
  if (allowance === "limit") {
    return {
      ok: false,
      error: `You've used all ${DAILY_AI_LIMIT} AI requests for the last day. Try again tomorrow, or type the recipe in below.`,
    };
  }

  const result = await readRecipeFromPhotos(photos);
  if (!result.ok) return { ok: false, error: PHOTO_ERRORS[result.reason] };

  const { recipe } = result;
  return {
    ok: true,
    complete: recipe.ingredients.length > 0 && recipe.steps.length > 0,
    draft: {
      title: recipe.title,
      servings: recipe.servings ?? 4,
      source_type: "cookbook",
      source_name: recipe.sourceName,
      source_url: null,
      ingredientsText: parseIngredientLines(recipe.ingredients.join("\n"))
        .map(formatIngredient)
        .join("\n"),
      stepsText: recipe.steps.join("\n"),
      nutrition: recipe.nutrition,
    },
  };
}

export type EstimateNutritionResult =
  { ok: true; nutrition: Nutrition } | { ok: false; error: string } | null;

const ESTIMATE_ERRORS = {
  not_configured: "AI estimates aren't set up yet. You can type the numbers in.",
  busy: "The AI is busy right now (free tier). Try again in a minute.",
  not_estimable: "Couldn't estimate from these ingredients. Add amounts, like “2 cups rice”.",
  failed: "Couldn't estimate that. Try again, or type the numbers in.",
} as const;

// Estimates nutrition per serving from the recipe form's current ingredients (not saved
// yet). The numbers only fill the form; the person checks them and saves.
export async function estimateRecipeNutrition(input: {
  title: string;
  servings: number;
  ingredients: string;
}): Promise<EstimateNutritionResult> {
  await requireUser();
  const parsed = estimateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? ESTIMATE_ERRORS.failed };
  }
  const { title, servings, ingredients } = parsed.data;

  const allowance = await takeAiRequest();
  if (allowance === "error") return { ok: false, error: ESTIMATE_ERRORS.failed };
  if (allowance === "limit") {
    return {
      ok: false,
      error: `You've used all ${DAILY_AI_LIMIT} AI requests for the last day. Try again tomorrow, or type the numbers in.`,
    };
  }

  const result = await estimateNutrition({
    title: title || "Recipe",
    servings,
    ingredients: ingredients.map(formatIngredient),
  });
  return result.ok ? result : { ok: false, error: ESTIMATE_ERRORS[result.reason] };
}

const estimateInputSchema = z.object({
  title: z
    .string()
    .max(120)
    .transform((s) => s.trim()),
  servings: z.number().int().min(1).max(50),
  ingredients: z
    .string()
    .max(20_000)
    .transform((s) => parseIngredientLines(s))
    .pipe(
      z
        .array(z.custom<ReturnType<typeof parseIngredientLines>[number]>())
        .min(1, "Add the ingredients first, then estimate.")
        .max(200),
    ),
});
