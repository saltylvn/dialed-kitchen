"use server";

import { formatIngredient, parseIngredientLines } from "@/lib/ingredients";
import { extractRecipe, pageTitle } from "@/lib/recipeImport";
import { LinkRefused } from "@/lib/security/fetchUrl";
import { requireUser } from "@/lib/server/auth";
import { fetchPublicPage, FetchRefused } from "@/lib/server/safeFetch";
import type { RecipeDraft } from "./schema";

// Import a recipe from a link: fetch the page safely (lib/server/safeFetch), read its
// standard recipe data (lib/recipeImport), and return a draft for the person to check and
// save. Nothing is saved here.

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
    },
  };
}
